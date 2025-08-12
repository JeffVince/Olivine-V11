# Crew & Contacts Management

* [ ] **Crew & Contacts Management:** (Phase 2 scope) Interface to manage key people (crew, cast, etc.) and their info, to support call sheet generation and communications.

  * [ ] **Crew List:** Display a list of crew members (and cast, if needed) associated with the project, including their role/position (e.g. Director, Gaffer), name, and primary contact info (phone/email). This may be accessible via a "Crew" tab in the project.
  * [ ] **Add New Crew Member:** Provide a form to add a person with fields for name, role/title (dropdown or free text for common roles), phone, email, and possibly additional notes (e.g. "arrives late on Day 3"). Validate required fields and format (e.g. valid email). On save, update the list and store the info in the database.
  * [ ] **Edit/Remove Crew:** Allow editing an existing member's details (with similar validation) and removing a member if needed (with confirmation). Removing might simply mark them inactive if preserving history is important (so past call sheets don't lose info).
  * [ ] **Integration with Call Sheets:** The crew data should feed into call sheet generation (the AI uses this list to populate the "Crew & Contacts" section). If crew info is incomplete or missing (e.g. no contact number), highlight that so the user knows to fill it in before generating call sheets.
  * [ ] **Bulk Import (optional):** Possibly allow importing crew from a file (CSV or from reference project data) to speed setup. If implemented, provide an import button and guide the user through mapping columns to fields.
  * [ ] **Permissions:** Only project owners or designated managers can add/edit crew. Regular members might view the list but not modify it. Ensure these controls respect role permissions.
