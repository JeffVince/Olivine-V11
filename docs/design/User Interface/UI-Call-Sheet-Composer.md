# Call Sheet Composer (AI-Assisted Call Sheets)

* [ ] **Call Sheet Composer (AI-Assisted Call Sheets):** The UI flow for generating and reviewing call sheets via the Template Composer agent.

  * [ ] **Call Sheets Section:** Provide a section/tab that lists all call sheets created for the project, each labeled by date (and possibly day number or title). Show status (Draft or Final), and allow clicking one to view/download it. Include a "New Call Sheet" button to start the creation flow.
  * [ ] **New Call Sheet Form:** On initiating a new call sheet, present a form to collect necessary inputs:

    * [ ] **Date or Shoot Day:** Let user pick the date for the call sheet (date picker) or a shoot day index if they number their shooting days.
    * [ ] **Template Selection:** If multiple call sheet templates are available, allow choosing one (e.g. "Standard Call Sheet" vs "Company X Format"). If only one default template, just show it or skip this.
    * [ ] **Unit/Title:** (Optional) Field for unit name or call sheet title (e.g. "Second Unit" or episode title) if applicable.
    * [ ] **Call Time & Location:** Fields for main call time and location. These can default to common values (e.g. 7:00 AM, primary location) but allow override.
    * [ ] **Special Notes:** An optional text field for the user to input any specific notes or instructions to include on the call sheet.
    * [ ] Validate the form (date required, etc.) and enable "Generate" (or "Create Call Sheet") button.
  * [ ] **Generation Progress:** After submission, indicate that the AI generation is in progress. Possibly show a loading state or progress bar, and use streaming updates if available (e.g. "Gathering crew info…", "Fetching weather…") to keep the user informed. If generation takes more than a couple of seconds, maintain user engagement with a spinner and status messages. Any errors from the AI or missing data should be caught: if the agent cannot find critical info (like crew list or schedule), the UI might get a callback to inform the user (e.g. "Crew list not found – call sheet may be incomplete").
  * [ ] **Draft Preview:** Once the AI returns a draft, display the call sheet in a formatted preview mode. Render it in a user-friendly format (could be a styled HTML preview, or a generated PDF embedded, or a specialized layout). Ensure sections (Location, Weather, Crew, Schedule, Notes, etc.) are clearly legible. If any placeholders or blanks are present (due to missing info), highlight them so the user knows what might need manual input.
  * [ ] **Review & Edit:** Allow the user to review the draft. For MVP, direct in-browser editing might not be supported, but in Phase 2 consider enabling minor edits without re-generation (e.g. make the Notes section editable, or fill in a missing call time). At minimum, provide options:

    * [ ] **Regenerate or Update:** If the draft isn't satisfactory, the user can go back or open a modal to adjust inputs (or provide additional info) and run the generation again. For example, if a scene detail was missing, they could cancel, update a schedule file or add a note, and retry.
    * [ ] **Accept Draft:** If the draft looks good, the user proceeds to save/finalize it.
  * [ ] **Saving & Finalizing:** On acceptance, generate the final call sheet artifact:

    * [ ] Convert the draft into a PDF (or designated format). This can be done via a backend service or client-side PDF library. Ensure the formatting matches the chosen template (font styles, branding if any).
    * [ ] Save/upload the generated call sheet file to the project's storage (e.g. to a "Call Sheets" folder in Dropbox). This should create a new File record in the database and appear in the File Explorer.
    * [ ] Update the call sheet list UI with this new entry (mark as Final or with version if multiple per day).
    * [ ] Log the creation in the Ops Ledger (e.g. "Call sheet for 2025-08-15 created by \[User] via AI").
    * [ ] If generation failed or partially succeeded (e.g. couldn't fetch weather), alert the user that the call sheet was saved but might need edits.
  * [ ] **Distribution Options:** (Phase 2) After saving, provide convenient options to distribute the call sheet to the team. For MVP this may be manual (user downloads PDF and emails it), but plan for integrated distribution. Potential features:

    * [ ] **Email to Crew:** Button to send the call sheet via email to all or selected crew members (using their emails from Crew list). Possibly allow a custom message.
    * [ ] **Slack/WhatsApp Broadcast:** If integrated, allow posting the call sheet or a link to it in a Slack channel or WhatsApp group via the Composio connectors.
    * [ ] **Print Friendly View:** A printer-ready format or direct print option for physical distribution on set.
  * [ ] **Versioning & Updates:** If multiple call sheets can be created for the same date (updates), consider how to display versions (e.g. v1, v2) or replace the old one. Ideally, if a call sheet is regenerated, either supersede the previous (mark it as updated) or list both with timestamps. If the system doesn't formally version them, clarify that a new generation for the same date simply overwrites or creates a new file with a suffix. If call sheets are edited offline and re-uploaded, the UI should still list them and possibly differentiate from AI-generated ones.
