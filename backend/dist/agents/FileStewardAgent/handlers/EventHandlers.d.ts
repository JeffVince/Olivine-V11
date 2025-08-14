import { EventEmitter } from 'events';
import { FileRepository } from '../graph/FileRepository';
import { FolderRepository } from '../graph/FolderRepository';
import { ClassificationRepository } from '../graph/ClassificationRepository';
import { ContentRepository } from '../graph/ContentRepository';
import { QueueService } from '../../../services/queues/QueueService';
import { PostgresService } from '../../../services/PostgresService';
import { Classifier } from '../classification/Classifier';
import { Extractor } from '../extraction/Extractor';
import { FileMetadata } from '../types';
export declare class EventHandlers {
    private files;
    private folders;
    private classification;
    private content;
    private queues;
    private postgres;
    private classifier;
    private extractor;
    private clusterMode;
    private eventBus;
    constructor(deps: {
        files: FileRepository;
        folders: FolderRepository;
        classification: ClassificationRepository;
        content: ContentRepository;
        queues: QueueService;
        postgres: PostgresService;
        classifier: Classifier;
        extractor: Extractor;
        clusterMode: boolean;
        eventBus: EventEmitter;
    });
    extractFileMetadata(eventData: any): FileMetadata;
    ensureFolderHierarchy(orgId: string, sourceId: string, filePath: string): Promise<void>;
    handleFileCreated(orgId: string, sourceId: string, resourcePath: string, eventData: any, commitId: string): Promise<void>;
    handleFileUpdated(orgId: string, sourceId: string, resourcePath: string, eventData: any, commitId: string): Promise<void>;
    handleFileDeleted(orgId: string, sourceId: string, resourcePath: string, _eventData: any, _commitId: string): Promise<void>;
    classifyFile(jobData: any): Promise<void>;
    extractContent(jobData: any): Promise<void>;
    private shouldClassifyFile;
    private shouldExtractContent;
    private hasSignificantChanges;
}
//# sourceMappingURL=EventHandlers.d.ts.map