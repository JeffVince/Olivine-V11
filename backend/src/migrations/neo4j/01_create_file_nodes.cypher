/* Create File nodes with properties */
CREATE CONSTRAINT file_id IF NOT EXISTS FOR (f:File) REQUIRE f.id IS UNIQUE;

/* Create Organization nodes with properties */
CREATE CONSTRAINT org_id IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE;

/* Create Source nodes with properties */
CREATE CONSTRAINT source_id IF NOT EXISTS FOR (s:Source) REQUIRE s.id IS UNIQUE;

/* Create indexes for performance */
CREATE INDEX file_org_id IF NOT EXISTS FOR (f:File) ON (f.orgId);

CREATE INDEX file_source_id IF NOT EXISTS FOR (f:File) ON (f.sourceId);

CREATE INDEX file_path IF NOT EXISTS FOR (f:File) ON (f.path);

CREATE INDEX file_name IF NOT EXISTS FOR (f:File) ON (f.name);

CREATE INDEX file_extension IF NOT EXISTS FOR (f:File) ON (f.extension);

CREATE INDEX file_mime_type IF NOT EXISTS FOR (f:File) ON (f.mimeType);

CREATE INDEX file_size IF NOT EXISTS FOR (f:File) ON (f.size);

CREATE INDEX file_created_at IF NOT EXISTS FOR (f:File) ON (f.createdAt);

CREATE INDEX file_updated_at IF NOT EXISTS FOR (f:File) ON (f.updatedAt);

CREATE INDEX file_modified_at IF NOT EXISTS FOR (f:File) ON (f.modifiedAt);

CREATE INDEX file_deleted_at IF NOT EXISTS FOR (f:File) ON (f.deletedAt);

CREATE INDEX file_version_id IF NOT EXISTS FOR (f:File) ON (f.versionId);
