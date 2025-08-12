"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassificationService = void 0;
class ClassificationService {
    constructor(pg, llm, prompts) {
        this.pg = pg;
        this.llm = llm;
        this.prompts = prompts;
    }
    async classify(orgId, file) {
        const rule = await this.matchRule(orgId, file);
        if (rule) {
            return {
                slotKey: rule.slot_key,
                confidence: rule.priority ? Math.min(1, Math.max(0.5, 1 - rule.priority * 0.05)) : 0.8,
                ruleId: rule.id,
                method: 'taxonomy',
            };
        }
        if (this.llm && this.prompts) {
            const prompt = await this.prompts.getPrompt('classification_prompt');
            const response = await this.llm.complete(prompt.buildMessages({ file }), prompt.params);
            const parsed = prompt.parse(response);
            return {
                slotKey: parsed.slotKey,
                confidence: parsed.confidence,
                ruleId: null,
                method: 'llm',
            };
        }
        return { slotKey: 'UNCLASSIFIED', confidence: 0, ruleId: null, method: 'taxonomy' };
    }
    async matchRule(orgId, file) {
        const query = `
      SELECT id, slot_key, match_pattern, priority
      FROM taxonomy_rules
      WHERE org_id = $1 AND enabled = true
      ORDER BY priority ASC
    `;
        const result = await this.pg.executeQuery(query, [orgId]);
        for (const r of result.rows) {
            try {
                const re = new RegExp(r.match_pattern, 'i');
                if (re.test(file.path) || re.test(file.name))
                    return r;
            }
            catch {
            }
        }
        return null;
    }
}
exports.ClassificationService = ClassificationService;
//# sourceMappingURL=ClassificationService.js.map