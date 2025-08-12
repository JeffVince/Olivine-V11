# Projects Dashboard

* [ ] **Projects Dashboard:** Provides an overview of all projects and access to project-level actions.

  * [ ] **Project List & Selection:** Display all projects the user can access, showing project name, company (if applicable), last activity, and integration status (e.g. connected storage) for each. Each project entry is clickable to open that project's workspace. If no projects exist, show an empty state with guidance to create a new project.
  * [ ] **Create New Project:** Offer a "New Project" action that opens a form/modal to input project name and select a storage source (Dropbox, Google Drive, etc.) and root folder to monitor. If supported, allow linking a reference project (past project folder) during creation to import naming conventions and templates.

    * [ ] Validate required fields (e.g. non-empty name, unique name if needed, folder selected) and disable submission until valid.
    * [ ] If a reference project is provided, trigger the backend learning process after creation and inform the user (e.g. "Importing policies from reference project…") – the UI should reflect when this completes or if it fails (with error feedback).
    * [ ] On project creation success, update the project list and navigate into the new project's File Explorer. Handle errors (e.g. integration permission issues) with clear messages and allow retry or editing inputs.
  * [ ] **Project Actions (Rename/Archive/Delete):** For each project (especially on hover or via a context menu), provide options to rename or remove the project.

    * [ ] Renaming a project updates its name in the list (with validation on name).
    * [ ] Deleting/archiving a project requires confirmation (modal with project name verification) and only allowed for authorized users (project owner/admin). After deletion, ensure it's removed from UI and any associated data is cleaned up or archived.
  * [ ] **Project Roles & Team (if multi-user):** Indicate project members and roles (e.g. show number of collaborators or owner icon). Provide a way to invite team members (enter email, assign role like Producer, Coordinator, Viewer) and list existing members. Manage invites and removals in a sub-page or modal, with appropriate permissions (only owners can manage team).
