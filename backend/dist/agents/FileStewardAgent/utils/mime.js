"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferMimeType = inferMimeType;
function inferMimeType(filename) {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypes = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        txt: 'text/plain',
        html: 'text/html',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        mp4: 'video/mp4',
        mp3: 'audio/mpeg',
        zip: 'application/zip',
        json: 'application/json'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}
//# sourceMappingURL=mime.js.map