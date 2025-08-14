import { ClassificationCondition, ClassificationResult, TaxonomyRule } from '../types'

export class RuleEngine {
  async performRuleBasedClassification(rules: TaxonomyRule[], fileData: any): Promise<ClassificationResult> {
    for (const rule of rules) {
      if (await this.evaluateRule(rule, fileData)) {
        return {
          slotKey: rule.slotKey,
          confidence: await this.calculateConfidence(rule, fileData),
          ruleId: rule.id,
          method: 'taxonomy',
          metadata: { ruleName: rule.matchPattern, priority: rule.priority }
        }
      }
    }
    return { slotKey: 'UNCLASSIFIED', confidence: 0, ruleId: undefined, method: 'default' }
  }

  async evaluateRule(rule: TaxonomyRule, fileData: any): Promise<boolean> {
    if (rule.fileType && !fileData.mimeType?.startsWith(rule.fileType)) return false
    for (const condition of rule.conditions) {
      if (!await this.evaluateCondition(condition, fileData)) return false
    }
    return true
  }

  async evaluateCondition(condition: ClassificationCondition, fileData: any): Promise<boolean> {
    let fieldValue: any
    switch (condition.type) {
      case 'filename': fieldValue = fileData.name; break
      case 'path': fieldValue = fileData.path; break
      case 'size': fieldValue = fileData.size; break
      case 'mime_type': fieldValue = fileData.mimeType; break
      case 'content': fieldValue = fileData.extractedText || ''; break
      default: return false
    }
    return this.applyOperator(condition.operator, fieldValue, condition.value, condition.caseSensitive)
  }

  applyOperator(operator: string, fieldValue: any, conditionValue: any, caseSensitive = true): boolean {
    if (fieldValue == null) return false
    switch (operator) {
      case 'matches': {
        const regex = new RegExp(conditionValue, caseSensitive ? 'g' : 'gi')
        return regex.test(String(fieldValue))
      }
      case 'contains': {
        const searchValue = caseSensitive ? String(conditionValue) : String(conditionValue).toLowerCase()
        const searchField = caseSensitive ? String(fieldValue) : String(fieldValue).toLowerCase()
        return searchField.includes(searchValue)
      }
      case 'equals': return String(fieldValue) === String(conditionValue)
      case 'greater_than': return Number(fieldValue) > Number(conditionValue)
      case 'less_than': return Number(fieldValue) < Number(conditionValue)
      default: return false
    }
  }

  async calculateConfidence(rule: TaxonomyRule, fileData: any): Promise<number> {
    const totalConditions = rule.conditions.length
    if (totalConditions === 0) return 0.5
    let matchingConditions = 0
    for (const condition of rule.conditions) {
      if (await this.evaluateCondition(condition, fileData)) matchingConditions++
    }
    const baseConfidence = matchingConditions / totalConditions
    const priorityBonus = Math.min(rule.priority / 100, 0.2)
    return Math.min(baseConfidence + priorityBonus, 1.0)
  }

  getDefaultClassification(fileData: any): ClassificationResult {
    const mimeType = fileData.mimeType
    let slotKey = 'UNCLASSIFIED'
    let confidence = 0.3
    if (mimeType?.startsWith('image/')) { slotKey = 'IMAGES'; confidence = 0.7 }
    else if (mimeType?.startsWith('video/')) { slotKey = 'VIDEOS'; confidence = 0.7 }
    else if (mimeType?.startsWith('audio/')) { slotKey = 'AUDIO'; confidence = 0.7 }
    else if (mimeType === 'application/pdf') { slotKey = 'DOCUMENTS'; confidence = 0.6 }
    else if (mimeType?.includes('document') || mimeType?.includes('sheet')) { slotKey = 'DOCUMENTS'; confidence = 0.6 }
    else if (mimeType?.startsWith('text/')) { slotKey = 'TEXT_FILES'; confidence = 0.6 }
    return { slotKey, confidence, method: 'default', metadata: { reason: 'MIME type based classification', mimeType } }
  }
}


