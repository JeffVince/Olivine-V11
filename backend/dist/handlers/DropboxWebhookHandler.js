"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropboxWebhookHandler = void 0;
const crypto = __importStar(require("crypto"));
const dropbox_1 = require("dropbox");
const PostgresService_1 = require("../services/PostgresService");
const ConfigService_1 = require("../services/ConfigService");
const FileProcessingService_1 = require("../services/FileProcessingService");
const EventProcessingService_1 = require("../services/EventProcessingService");
const uuid_1 = require("uuid");
class DropboxWebhookHandler {
    constructor(queueService) {
        this.postgresService = new PostgresService_1.PostgresService();
        this.queueService = queueService;
        this.configService = new ConfigService_1.ConfigService();
        const eventProcessingService = new EventProcessingService_1.EventProcessingService(null, queueService);
        this.fileProcessingService = new FileProcessingService_1.FileProcessingService(eventProcessingService);
        eventProcessingService.fileProcessingService = this.fileProcessingService;
        this.eventProcessingService = eventProcessingService;
        this.webhookSecret = process.env.DROPBOX_WEBHOOK_SECRET || '';
    }
    validateSignature(body, signature) {
        try {
            const expectedSignature = crypto
                .createHmac('sha256', this.webhookSecret)
                .update(body)
                .digest('hex');
            return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
        }
        catch (error) {
            console.error('Error validating webhook signature:', error);
            return false;
        }
    }
    async handleWebhook(req, res) {
        try {
            const signature = req.headers['x-dropbox-signature'];
            const body = JSON.stringify(req.body);
            if (req.query.challenge) {
                res.status(200).send(req.query.challenge);
                return;
            }
            if (!this.validateSignature(body, signature)) {
                res.status(401).json({ error: 'Invalid signature' });
                return;
            }
            const { list_folder } = req.body;
            if (list_folder && list_folder.accounts) {
                for (const account of list_folder.accounts) {
                    await this.processDeltaChanges(account);
                }
            }
            res.status(200).json({ status: 'processed' });
        }
        catch (error) {
            console.error('Error handling Dropbox webhook:', error instanceof Error ? error.message : String(error));
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async processDeltaChanges(account) {
        try {
            const sourcesQuery = `
        SELECT id, orgId, metadata
        FROM sources 
        WHERE metadata->>'dropbox_account_id' = $1 OR metadata->>'dropbox_team_member_id' = $1
      `;
            const sourcesResult = await this.postgresService.executeQuery(sourcesQuery, [account]);
            for (const source of sourcesResult.rows) {
                const sourceId = source.id;
                const orgId = source.orgId;
                const metadata = source.metadata;
                let cursor = metadata.dropbox_cursor;
                if (!cursor && metadata.cursor) {
                    cursor = metadata.cursor;
                }
                if (!cursor) {
                    await this.handleFullListing(orgId, sourceId, account);
                    continue;
                }
                const dropboxOptions = {
                    accessToken: metadata.dropbox_access_token,
                    clientId: process.env.DROPBOX_APP_KEY || '',
                    clientSecret: process.env.DROPBOX_APP_SECRET || ''
                };
                if (metadata.dropbox_team_member_id) {
                    dropboxOptions.selectUser = metadata.dropbox_team_member_id;
                }
                const dropboxClient = new dropbox_1.Dropbox(dropboxOptions);
                let hasMore = true;
                let currentCursor = cursor;
                while (hasMore) {
                    try {
                        const response = await dropboxClient.filesListFolderContinue({
                            cursor: currentCursor
                        });
                        for (const entry of response.result.entries) {
                            await this.processFileEntry(orgId, sourceId, account, entry);
                        }
                        hasMore = response.result.has_more;
                        currentCursor = response.result.cursor;
                    }
                    catch (error) {
                        if (error.error_summary && error.error_summary.includes('reset')) {
                            console.log(`Cursor reset for source ${sourceId}, performing full listing`);
                            await this.handleCursorReset(orgId, sourceId, account);
                            hasMore = false;
                        }
                        else {
                            throw error;
                        }
                    }
                }
                await this.storeCursor(orgId, sourceId, currentCursor);
            }
        }
        catch (error) {
            console.error(`Error processing delta changes for account ${account}:`, error);
            throw error;
        }
    }
    async processFileEntry(orgId, sourceId, account, entry) {
        try {
            if (entry['.tag'] === 'deleted') {
                await this.handleDeletedFile(orgId, sourceId, entry);
            }
            else {
                await this.handleModifiedFile(orgId, sourceId, entry);
            }
        }
        catch (error) {
            console.error(`Error processing file entry for ${entry.path_display}:`, error);
            throw error;
        }
    }
    async handleModifiedFile(orgId, sourceId, entry) {
        const normalizedMetadata = {
            name: entry.name,
            path: entry.path_display,
            size: entry.size,
            modified: entry.client_modified || entry.server_modified,
            is_folder: entry['.tag'] === 'folder',
            mime_type: entry['.tag'] === 'file' ? entry.content_hash : null,
            revision: entry.rev,
            id: entry.id
        };
        const upsertQuery = `
      INSERT INTO files (orgId, source_id, path, metadata)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (orgId, source_id, path) 
      DO UPDATE SET 
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `;
        await this.postgresService.executeQuery(upsertQuery, [
            orgId,
            sourceId,
            entry.path_display,
            JSON.stringify(normalizedMetadata)
        ]);
        if (entry['.tag'] === 'file') {
            const fileId = (0, uuid_1.v4)();
            await this.fileProcessingService.processFileChange({
                fileId,
                orgId: orgId,
                sourceId,
                filePath: entry.path_display,
                action: 'create',
                metadata: normalizedMetadata
            });
            await this.queueService.addJob('file-sync', 'sync-event', {
                orgId,
                sourceId,
                eventType: 'file_updated',
                resourcePath: entry.path_display,
                eventData: normalizedMetadata,
            });
        }
    }
    async handleDeletedFile(orgId, sourceId, entry) {
        const deleteQuery = `
      UPDATE files 
      SET deleted_at = NOW()
      WHERE orgId = $1 AND source_id = $2 AND path = $3
    `;
        await this.postgresService.executeQuery(deleteQuery, [
            orgId,
            sourceId,
            entry.path_display
        ]);
        const fileId = (0, uuid_1.v4)();
        await this.fileProcessingService.processFileChange({
            fileId,
            orgId: orgId,
            sourceId,
            filePath: entry.path_display,
            action: 'delete'
        });
        await this.queueService.addJob('file-sync', 'sync-event', {
            orgId,
            sourceId,
            eventType: 'file_deleted',
            resourcePath: entry.path_display,
            eventData: { id: entry.id },
        });
    }
    async handleCursorReset(orgId, sourceId, account) {
        await this.storeCursor(orgId, sourceId, null);
        await this.handleFullListing(orgId, sourceId, account);
    }
    async handleFullListing(orgId, sourceId, account) {
        try {
            const sourceQuery = `
        SELECT metadata
        FROM sources 
        WHERE id = $1 AND orgId = $2
      `;
            const sources = await this.postgresService.executeQuery(sourceQuery, [sourceId, orgId]);
            if (sources.rows.length === 0) {
                console.warn(`Source not found: ${sourceId} for org ${orgId}`);
                return;
            }
            const metadata = sources.rows[0].metadata;
            const dropboxOptions = {
                accessToken: metadata.dropbox_access_token,
                clientId: process.env.DROPBOX_APP_KEY || '',
                clientSecret: process.env.DROPBOX_APP_SECRET || ''
            };
            if (metadata.dropbox_team_member_id) {
                dropboxOptions.selectUser = metadata.dropbox_team_member_id;
            }
            if (metadata.dropbox_is_team_account === 'true') {
                if (metadata.dropbox_root_namespace_id) {
                    dropboxOptions.pathRoot = JSON.stringify({ '.tag': 'root', 'root': metadata.dropbox_root_namespace_id });
                }
            }
            else {
                dropboxOptions.pathRoot = JSON.stringify({ '.tag': 'home' });
            }
            const dropboxClient = new dropbox_1.Dropbox(dropboxOptions);
            let hasMore = true;
            let cursor = '';
            while (hasMore) {
                let response;
                if (cursor) {
                    response = await dropboxClient.filesListFolderContinue({ cursor });
                }
                else {
                    response = await dropboxClient.filesListFolder({
                        path: '',
                        recursive: true
                    });
                }
                for (const entry of response.result.entries) {
                    await this.processFileEntry(orgId, sourceId, account, entry);
                }
                hasMore = response.result.has_more;
                cursor = response.result.cursor;
            }
            await this.storeCursor(orgId, sourceId, cursor);
        }
        catch (error) {
            console.error(`Error during full listing for source ${sourceId}:`, error);
            throw error;
        }
    }
    async storeCursor(orgId, sourceId, cursor) {
        const query = `
      UPDATE sources 
      SET metadata = metadata || $1::jsonb,
          updated_at = NOW()
      WHERE orgId = $2 AND id = $3
    `;
        const metadata = cursor ? { dropbox_cursor: cursor } : { dropbox_cursor: null };
        await this.postgresService.executeQuery(query, [JSON.stringify(metadata), orgId, sourceId]);
    }
    async storeDropboxEvent(eventData) {
        const query = `
      INSERT INTO dropbox_events (org_id, source_id, cursor, event_data, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `;
        await this.postgresService.executeQuery(query, [
            eventData.org_id,
            eventData.source_id,
            eventData.cursor,
            JSON.stringify(eventData.event_data)
        ]);
    }
}
exports.DropboxWebhookHandler = DropboxWebhookHandler;
//# sourceMappingURL=DropboxWebhookHandler.js.map