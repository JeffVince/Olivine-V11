# ADR-001: AI Agent Framework for Content Extraction

## Status
Accepted

## Context
The ContentExtractionService was originally designed with hardcoded parsers for specific document types (scripts, budgets, call sheets). This approach has several limitations:

1. **Scalability Issues**: Adding support for new document types requires implementing new hardcoded parsers
2. **Maintenance Burden**: Each parser needs to be individually maintained and updated
3. **Limited Flexibility**: Cannot adapt to variations in document formats without code changes
4. **Domain Expertise**: Requires deep domain knowledge to implement accurate parsers

As part of the cluster-centric content processing system, we needed a more flexible approach that could handle the diversity and complexity of creative production documents.

## Decision
We will implement an AI agent-based extraction framework that:

1. **Replaces hardcoded parsers** with specialized AI agents for content extraction
2. **Uses LLMs as extraction engines** to identify structured content from documents
3. **Implements a routing mechanism** to direct extraction requests to appropriate agents
4. **Maintains backward compatibility** with existing parser infrastructure during transition
5. **Provides feature flag control** for gradual rollout and testing

### Framework Components

- **BaseExtractionAgent**: Abstract base class defining the extraction interface
- **AgentRegistry**: Registry for mapping slots to agents with feature flag support
- **Specialized Agents**: Concrete implementations for different document types (starting with OpenAIAgent)
- **LLM Abstraction**: Provider-agnostic LLM service interface
- **Prompt Management**: Structured prompt templates with JSON schema output formats

### Integration Approach

The ContentExtractionService will be modified to:

1. Check if an AI agent is registered and enabled for a given slot
2. Route extraction requests to AI agents when available
3. Fall back to traditional parsers when AI agents are disabled
4. Convert agent results to the existing extraction result format

## Consequences

### Positive

- **Improved Scalability**: Easy to add new agents for different document types
- **Reduced Maintenance**: Less hardcoded parsing logic to maintain
- **Increased Flexibility**: Agents can adapt to document variations
- **Better Quality**: LLMs can understand context and nuance better than rule-based parsers
- **Faster Development**: New document type support through prompt engineering rather than coding

### Negative

- **Cost**: LLM API calls incur per-use costs
- **Latency**: AI extraction may be slower than hardcoded parsers
- **Hallucination Risk**: LLMs may generate incorrect information
- **Dependency**: System now depends on external AI services

### Risks

- **Quality Control**: Need to implement confidence scoring and validation
- **Cost Management**: Need monitoring and budget controls for LLM usage
- **Fallback Reliability**: Traditional parsers must remain functional during AI service issues

## Implementation Plan

1. **Phase 1** (Completed): Implement core agent framework with OpenAI placeholder
   - BaseExtractionAgent interface
   - AgentRegistry with feature flag support
   - OpenAIAgent implementation
   - Integration with ContentExtractionService

2. **Phase 2** (Future): Enhance and expand
   - Specialized agents for different document types
   - Confidence scoring and validation mechanisms
   - Cost monitoring and budget controls
   - Improved prompt management

## Governance

### Versioning

- Agent implementations will follow semantic versioning (MAJOR.MINOR.PATCH)
- Prompts will be versioned alongside agents
- Breaking changes to agent interfaces require major version increments

### Feature Flags

- AI extraction is controlled by organization-level feature flags
- Each slot can have independent enablement
- Default behavior falls back to traditional parsers

### Monitoring

- Track extraction success rates and confidence scores
- Monitor LLM API usage and costs
- Log prompt versions and model parameters
- Alert on significant quality degradation

## References

- Cluster System Implementation Plan
- ContentExtractionService implementation
- Agent System Architecture documentation
