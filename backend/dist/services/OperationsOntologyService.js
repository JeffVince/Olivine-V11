"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationsOntologyService = void 0;
const Neo4jService_1 = require("./Neo4jService");
const ProvenanceService_1 = require("./provenance/ProvenanceService");
class OperationsOntologyService {
    constructor() {
        this.neo4j = new Neo4jService_1.Neo4jService();
        this.provenance = new ProvenanceService_1.ProvenanceService();
    }
    async createVendor(vendor, userId) {
        const vendorId = this.generateId();
        const commitId = this.generateId();
        const actionId = this.generateId();
        const query = `
      // Create commit for provenance
      CREATE (c:Commit {
        id: $commit_id,
        org_id: $org_id,
        message: "Created vendor: " + $name,
        author: $user_id,
        timestamp: datetime(),
        branch: "main"
      })
      
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: "operations_ontology_service",
        action_type: "CREATE_VENDOR",
        inputs: $inputs,
        outputs: $outputs,
        status: "success",
        timestamp: datetime()
      })
      
      // Link commit to action
      CREATE (c)-[:INCLUDES]->(a)
      WITH c,a
      
      // Create vendor
      CREATE (v:Vendor {
        id: $vendor_id,
        org_id: $org_id,
        name: $name,
        category: $category,
        contact_name: $contact_name,
        contact_email: $contact_email,
        contact_phone: $contact_phone,
        address: $address,
        tax_id: $tax_id,
        payment_terms: $payment_terms,
        preferred_payment_method: $preferred_payment_method,
        status: $status,
        rating: $rating,
        metadata: $metadata,
        created_at: datetime(),
        updated_at: datetime()
      })
      
      // Link action to vendor for provenance
      CREATE (a)-[:TOUCHED]->(v)
      
      RETURN v
    `;
        const result = await this.neo4j.executeQuery(query, {
            commit_id: commitId,
            action_id: actionId,
            vendor_id: vendorId,
            org_id: vendor.org_id,
            user_id: userId,
            name: vendor.name,
            category: vendor.category,
            contact_name: vendor.contact_name || null,
            contact_email: vendor.contact_email || null,
            contact_phone: vendor.contact_phone || null,
            address: vendor.address || null,
            tax_id: vendor.tax_id || null,
            payment_terms: vendor.payment_terms || null,
            preferred_payment_method: vendor.preferred_payment_method || null,
            status: vendor.status,
            rating: vendor.rating || null,
            metadata: JSON.stringify(vendor.metadata || {}),
            inputs: JSON.stringify({ name: vendor.name, category: vendor.category }),
            outputs: JSON.stringify({ vendor_id: vendorId })
        }, vendor.org_id);
        return result.records[0]?.get('v').properties;
    }
    async createPurchaseOrder(po, userId) {
        const poId = this.generateId();
        const commitId = this.generateId();
        const actionId = this.generateId();
        const query = `
      // Create commit for provenance
      CREATE (c:Commit {
        id: $commit_id,
        org_id: $org_id,
        message: "Created purchase order: " + $po_number,
        author: $user_id,
        timestamp: datetime(),
        branch: "main"
      })
      
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: "operations_ontology_service",
        action_type: "CREATE_PURCHASE_ORDER",
        inputs: $inputs,
        outputs: $outputs,
        status: "success",
        timestamp: datetime()
      })
      
      // Link commit to action
      CREATE (c)-[:INCLUDES]->(a)
      WITH c,a
      
      // Create purchase order
      CREATE (po:PurchaseOrder {
        id: $po_id,
        org_id: $org_id,
        project_id: $project_id,
        po_number: $po_number,
        vendor_id: $vendor_id,
        scene_id: $scene_id,
        crew_role: $crew_role,
        description: $description,
        amount: $amount,
        currency: $currency,
        status: $status,
        order_date: datetime($order_date),
        needed_date: CASE WHEN $needed_date IS NULL THEN NULL ELSE datetime($needed_date) END,
        delivery_address: $delivery_address,
        approved_by: $approved_by,
        created_by: $created_by,
        metadata: $metadata,
        created_at: datetime(),
        updated_at: datetime()
      })
      WITH c,a,po
      
      // Link to vendor
      MATCH (v:Vendor {id: $vendor_id, org_id: $org_id})
      CREATE (po)-[:FROM_VENDOR]->(v)
      WITH c,a,po
      
      // Link to scene if specified (without APOC map params to avoid Map types)
      WITH c,a,po
      OPTIONAL MATCH (s:Scene {id: $scene_id, org_id: $org_id})
      FOREACH (_ IN CASE WHEN $scene_id IS NOT NULL AND s IS NOT NULL THEN [1] ELSE [] END |
        CREATE (ef:EdgeFact {
          id: randomUUID(),
          type: 'FOR_SCENE',
          from_id: po.id,
          to_id: s.id,
          valid_from: datetime(),
          valid_to: null,
          org_id: $org_id,
          created_by_commit: $commit_id
        })
        CREATE (ef)-[:FROM]->(po)
        CREATE (ef)-[:TO]->(s)
      )
      
      // Link action to PO for provenance
      CREATE (a)-[:TOUCHED]->(po)
      
      RETURN po
    `;
        const result = await this.neo4j.executeQuery(query, {
            commit_id: commitId,
            action_id: actionId,
            po_id: poId,
            org_id: po.org_id,
            user_id: userId,
            project_id: po.project_id,
            po_number: po.order_number,
            vendor_id: po.vendor_id,
            scene_id: po.scene_id || null,
            crew_role: po.crew_role || null,
            description: po.description,
            amount: po.total_amount,
            currency: po.currency,
            status: po.status,
            order_date: (po.order_date instanceof Date ? po.order_date.toISOString() : po.order_date),
            needed_date: po.needed_date ? (po.needed_date instanceof Date ? po.needed_date.toISOString() : po.needed_date) : null,
            delivery_address: po.delivery_address || null,
            approved_by: po.approved_by || null,
            created_by: po.created_by,
            metadata: JSON.stringify(po.metadata || {}),
            inputs: JSON.stringify({ po_number: po.order_number, vendor_id: po.vendor_id, amount: po.total_amount }),
            outputs: JSON.stringify({ po_id: poId })
        }, po.org_id);
        const props = result.records[0]?.get('po').properties;
        if (!props)
            return props;
        return {
            ...props,
            order_number: props.po_number ?? po.order_number,
            vendor_id: props.vendor_id ?? po.vendor_id,
            amount: props.amount ?? po.total_amount,
        };
    }
    async createInvoice(invoice, userId) {
        const invoiceId = this.generateId();
        const commitId = this.generateId();
        const actionId = this.generateId();
        const query = `
      // Create commit for provenance
      CREATE (c:Commit {
        id: $commit_id,
        org_id: $org_id,
        message: "Created invoice: " + $invoice_number,
        author: $user_id,
        timestamp: datetime(),
        branch: "main"
      })
      
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: "operations_ontology_service",
        action_type: "CREATE_INVOICE",
        inputs: $inputs,
        outputs: $outputs,
        status: "success",
        timestamp: datetime()
      })
      
      // Link commit to action
      CREATE (c)-[:INCLUDES]->(a)
      WITH c,a
      
      // Create invoice
      CREATE (i:Invoice {
        id: $invoice_id,
        org_id: $org_id,
        project_id: $project_id,
        vendor_id: $vendor_id,
        po_id: $po_id,
        invoice_number: $invoice_number,
        amount: $amount,
        currency: $currency,
        tax_amount: $tax_amount,
        total_amount: $total_amount,
        invoice_date: datetime($invoice_date),
        due_date: datetime($due_date),
        status: $status,
        payment_date: CASE WHEN $payment_date IS NULL THEN NULL ELSE datetime($payment_date) END,
        payment_method: $payment_method,
        approved_by: $approved_by,
        metadata: $metadata,
        created_at: datetime(),
        updated_at: datetime()
      })
      
      // Link to vendor
      MATCH (v:Vendor {id: $vendor_id, org_id: $org_id})
      CREATE (i)-[:FROM_VENDOR]->(v)
      
      // Link to purchase order if specified
      CALL apoc.do.when(
        $po_id IS NOT NULL,
        "
        MATCH (po:PurchaseOrder {id: $po_id, org_id: $org_id})
        CREATE (i)-[:PERTAINS_TO]->(po)
        RETURN po
        ",
        "RETURN null",
        {i: i, po_id: $po_id, org_id: $org_id}
      ) YIELD value
      
      // Link action to invoice for provenance
      CREATE (a)-[:TOUCHED]->(i)
      
      RETURN i
    `;
        const result = await this.neo4j.executeQuery(query, {
            commit_id: commitId,
            action_id: actionId,
            invoice_id: invoiceId,
            org_id: invoice.org_id,
            user_id: userId,
            project_id: invoice.project_id,
            vendor_id: invoice.vendor_id,
            po_id: invoice.po_id || null,
            invoice_number: invoice.invoice_number,
            amount: invoice.amount,
            currency: invoice.currency,
            tax_amount: invoice.tax_amount || null,
            total_amount: invoice.total_amount,
            invoice_date: (invoice.invoice_date instanceof Date ? invoice.invoice_date.toISOString() : invoice.invoice_date),
            due_date: (invoice.due_date instanceof Date ? invoice.due_date.toISOString() : invoice.due_date),
            status: invoice.status,
            payment_date: invoice.payment_date ? (invoice.payment_date instanceof Date ? invoice.payment_date.toISOString() : invoice.payment_date) : null,
            payment_method: invoice.payment_method || null,
            approved_by: invoice.approved_by || null,
            metadata: JSON.stringify(invoice.metadata || {}),
            inputs: JSON.stringify({ invoice_number: invoice.invoice_number, vendor_id: invoice.vendor_id, amount: invoice.amount }),
            outputs: JSON.stringify({ invoice_id: invoiceId })
        }, invoice.org_id);
        return result.records[0]?.get('i').properties;
    }
    async createBudget(budget, userId) {
        const budgetId = this.generateId();
        const commitId = this.generateId();
        const actionId = this.generateId();
        const query = `
      // Create commit for provenance
      CREATE (c:Commit {
        id: $commit_id,
        org_id: $org_id,
        message: "Created budget: " + $name + " v" + $version,
        author: $user_id,
        timestamp: datetime(),
        branch: "main"
      })
      
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: "operations_ontology_service",
        action_type: "CREATE_BUDGET",
        inputs: $inputs,
        outputs: $outputs,
        status: "success",
        timestamp: datetime()
      })
      
      // Link commit to action
      CREATE (c)-[:INCLUDES]->(a)
      
      // Create budget
      CREATE (b:Budget {
        id: $budget_id,
        org_id: $org_id,
        project_id: $project_id,
        name: $name,
        total_budget: $total_budget,
        currency: $currency,
        status: $status,
        version: $version,
        approved_by: $approved_by,
        approved_date: $approved_date,
        metadata: $metadata,
        created_at: datetime(),
        updated_at: datetime()
      })
      
      // Link action to budget for provenance
      CREATE (a)-[:TOUCHED]->(b)
      
      RETURN b
    `;
        const result = await this.neo4j.executeQuery(query, {
            commit_id: commitId,
            action_id: actionId,
            budget_id: budgetId,
            org_id: budget.org_id,
            user_id: userId,
            project_id: budget.project_id,
            name: budget.name,
            total_budget: budget.total_budget,
            currency: budget.currency,
            status: budget.status,
            version: budget.version,
            approved_by: budget.approved_by || null,
            approved_date: budget.approved_date || null,
            metadata: JSON.stringify(budget.metadata || {}),
            inputs: JSON.stringify({ project_id: budget.project_id, name: budget.name, total_budget: budget.total_budget }),
            outputs: JSON.stringify({ budget_id: budgetId })
        }, budget.org_id);
        return result.records[0]?.get('b').properties;
    }
    async createComplianceRule(rule, userId) {
        const ruleId = this.generateId();
        const commitId = this.generateId();
        const actionId = this.generateId();
        const query = `
      // Create commit for provenance
      CREATE (c:Commit {
        id: $commit_id,
        org_id: $org_id,
        message: "Created compliance rule: " + $name,
        author: $user_id,
        timestamp: datetime(),
        branch: "main"
      })
      
      // Create action
      CREATE (a:Action {
        id: $action_id,
        tool: "operations_ontology_service",
        action_type: "CREATE_COMPLIANCE_RULE",
        inputs: $inputs,
        outputs: $outputs,
        status: "success",
        timestamp: datetime()
      })
      
      // Link commit to action
      CREATE (c)-[:INCLUDES]->(a)
      
      // Create compliance rule
      CREATE (cr:ComplianceRule {
        id: $rule_id,
        org_id: $org_id,
        name: $name,
        category: $category,
        description: $description,
        jurisdiction: $jurisdiction,
        authority: $authority,
        severity: $severity,
        effective_date: $effective_date,
        expiry_date: $expiry_date,
        status: $status,
        metadata: $metadata,
        created_at: datetime(),
        updated_at: datetime()
      })
      
      // Link action to rule for provenance
      CREATE (a)-[:TOUCHED]->(cr)
      
      RETURN cr
    `;
        const result = await this.neo4j.executeQuery(query, {
            commit_id: commitId,
            action_id: actionId,
            rule_id: ruleId,
            org_id: rule.org_id,
            user_id: userId,
            name: rule.name,
            category: rule.category,
            description: rule.description,
            jurisdiction: rule.jurisdiction || null,
            authority: rule.authority || null,
            severity: rule.severity,
            effective_date: rule.effective_date,
            expiry_date: rule.expiry_date || null,
            status: rule.status,
            metadata: JSON.stringify(rule.metadata || {}),
            inputs: JSON.stringify({ name: rule.name, category: rule.category, severity: rule.severity }),
            outputs: JSON.stringify({ rule_id: ruleId })
        }, rule.org_id);
        return result.records[0]?.get('cr').properties;
    }
    async getBudgetVsActualAnalysis(projectId, orgId) {
        const query = `
      MATCH (p:Project {id: $project_id, org_id: $org_id})
      MATCH (b:Budget {project_id: p.id, status: "approved"})
      
      // Get budget allocations by department
      WITH b, b.metadata.departments as budget_by_dept
      
      // Get actual spending
      MATCH (po:PurchaseOrder {project_id: $project_id, status: "approved"})
      OPTIONAL MATCH (po)<-[:FROM]-(ef:EdgeFact {type: "FOR_SCENE"})-[:TO]->(s:Scene)
      
      WITH budget_by_dept, 
           collect({
               department: coalesce(po.metadata.department, "unassigned"),
               amount: po.amount,
               scene: s.number
           }) as actual_spending
      
      RETURN 
          budget_by_dept,
          actual_spending,
          [dept IN keys(budget_by_dept) | {
              department: dept,
              budgeted: budget_by_dept[dept],
              actual: reduce(total = 0.0, spend IN actual_spending | 
                  CASE WHEN spend.department = dept THEN total + spend.amount ELSE total END),
              variance: budget_by_dept[dept] - reduce(total = 0.0, spend IN actual_spending | 
                  CASE WHEN spend.department = dept THEN total + spend.amount ELSE total END)
          }] as variance_analysis
    `;
        const result = await this.neo4j.executeQuery(query, { project_id: projectId, org_id: orgId }, orgId);
        return result.records[0]?.get('variance_analysis') || [];
    }
    async getVendorPerformanceAnalysis(orgId) {
        const query = `
      MATCH (v:Vendor {org_id: $org_id})
      OPTIONAL MATCH (v)<-[:FROM_VENDOR]-(po:PurchaseOrder)
      OPTIONAL MATCH (v)<-[:FROM_VENDOR]-(i:Invoice)
      
      WITH v, 
           count(po) as total_pos,
           sum(po.amount) as total_po_amount,
           count(i) as total_invoices,
           sum(i.total_amount) as total_invoice_amount,
           avg(duration.between(po.order_date, i.invoice_date).days) as avg_delivery_days
      
      RETURN 
          v.name as vendor_name,
          v.category as category,
          v.rating as rating,
          total_pos,
          total_po_amount,
          total_invoices,
          total_invoice_amount,
          avg_delivery_days,
          CASE 
              WHEN avg_delivery_days <= 7 THEN "Excellent"
              WHEN avg_delivery_days <= 14 THEN "Good"
              WHEN avg_delivery_days <= 21 THEN "Fair"
              ELSE "Poor"
          END as delivery_performance
      ORDER BY total_po_amount DESC
    `;
        const result = await this.neo4j.executeQuery(query, { org_id: orgId }, orgId);
        return result.records.map((record) => ({
            vendor_name: record.get('vendor_name'),
            category: record.get('category'),
            rating: record.get('rating'),
            total_pos: record.get('total_pos'),
            total_po_amount: record.get('total_po_amount'),
            total_invoices: record.get('total_invoices'),
            total_invoice_amount: record.get('total_invoice_amount'),
            avg_delivery_days: record.get('avg_delivery_days'),
            delivery_performance: record.get('delivery_performance')
        }));
    }
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.OperationsOntologyService = OperationsOntologyService;
//# sourceMappingURL=OperationsOntologyService.js.map