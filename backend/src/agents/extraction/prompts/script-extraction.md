# Script Extraction Prompt

## Objective
Extract structured information from a screenplay or script document, identifying scenes, characters, and other relevant entities.

## Input
A text representation of a script or screenplay.

## Output Format
Respond with a JSON object containing the following structure:

```json
{
  "entities": [
    {
      "type": "Scene",
      "properties": {
        "sceneNumber": "string (e.g., '1', '2A', '3b')",
        "title": "string (scene title if explicitly stated)",
        "setting": "string (e.g., 'INT. COFFEE SHOP - DAY')",
        "description": "string (brief description of the scene content)"
      },
      "confidence": "number (0.0 to 1.0)"
    },
    {
      "type": "Character",
      "properties": {
        "name": "string (character name)",
        "description": "string (brief character description if available)"
      },
      "confidence": "number (0.0 to 1.0)"
    }
  ],
  "links": [
    {
      "sourceType": "Scene",
      "sourceId": "string (matching scene identifier)",
      "targetType": "Character",
      "targetId": "string (matching character name)",
      "relationshipType": "APPEARS_IN",
      "properties": {
        "dialogueLines": "number (count of dialogue lines for this character in this scene)",
        "actionLines": "number (count of action lines for this character in this scene)"
      },
      "confidence": "number (0.0 to 1.0)"
    }
  ],
  "facts": [
    {
      "subject": "string (e.g., character name or scene title)",
      "predicate": "string (e.g., 'has_role', 'takes_place_in')",
      "object": "string (e.g., 'protagonist', 'coffee shop')",
      "confidence": "number (0.0 to 1.0)",
      "context": "string (optional context for the fact)"
    }
  ],
  "metadata": {
    "confidence": "number (0.0 to 1.0, overall confidence in extraction)",
    "processingTimeMs": "number (time taken to process in milliseconds)"
  }
}
```

## Instructions
1. Analyze the script text and identify all scenes and characters.
2. For each scene, extract the setting, scene number, and a brief description.
3. For each character, extract their name and any available description.
4. Create links between scenes and characters who appear in them.
5. Extract any notable facts about characters or scenes.
6. Provide confidence scores for each extracted item based on how clearly the information was presented in the source.
7. Do not include any text in your response other than the JSON object.
8. If you cannot extract certain information, omit those fields or entities rather than guessing.
9. Ensure all JSON is properly formatted and valid.
