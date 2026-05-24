# Sprint 4: Recommendation Engine Implementation Plan

## Technical Architecture Overview

Sprint 4 introduces the **LLM-powered recommendation layer** that transforms raw ML predictions into actionable sales intelligence. The architecture follows a three-stage pipeline:

```
[ML Predictions] → [Data Fusion] → [LLM Service] → [llm_recommendations Table]
```

---

## 1. Sprint 4 Task Breakdown

### Phase 1: Database Schema & Models (Days 1-2)

#### Task 1.1: Create `llm_recommendations` Table Migration
**Priority:** Critical  
**Estimated Time:** 2 hours

Create Alembic migration for the recommendations table with proper foreign key constraints and indexes.

#### Task 1.2: Define SQLAlchemy ORM Model
**Priority:** Critical  
**Estimated Time:** 1 hour

Update `models/schema.py` with the `LLMRecommendation` class (already partially defined in your codebase, needs refinement).

---

### Phase 2: LLM Service Layer (Days 2-4)

#### Task 2.1: Design Prompt Engineering Template
**Priority:** Critical  
**Estimated Time:** 4 hours

Create the few-shot prompt template in `models/ai_agents/prompts.py` with:
- System prompt defining the AI's role
- 3-5 few-shot examples covering diverse scenarios
- Output schema validation requirements

#### Task 2.2: Build LLM Service Class
**Priority:** Critical  
**Estimated Time:** 6 hours

Implement `models/ai_agents/recommender.py` with:
- API client initialization (OpenAI or Anthropic)
- Retry logic with exponential backoff
- Response validation and parsing
- Fallback handling for API failures

#### Task 2.3: Implement Data Fusion Logic
**Priority:** High  
**Estimated Time:** 3 hours

Create `fuse_deal_payload()` function to merge:
- `base_probability` from `ml_predictions`
- `custom_fields` from `zoho_deals`
- Engineered features for context

---

### Phase 3: Integration & Orchestration (Days 4-6)

#### Task 3.1: Create Recommendation Controller
**Priority:** High  
**Estimated Time:** 4 hours

Build `controllers/recommendation_controller.py` with endpoints:
- `POST /api/v1/recommendations/generate` - Single deal
- `POST /api/v1/recommendations/batch` - Batch processing

#### Task 3.2: Implement Batch Pipeline
**Priority:** Critical  
**Estimated Time:** 5 hours

Extend `controllers/ml_controller.py` batch job to:
1. Score deals with ML model
2. Fetch custom fields from `zoho_deals`
3. Call LLM service for each prediction
4. Upsert results to `llm_recommendations`

#### Task 3.3: Add APScheduler Integration
**Priority:** Medium  
**Estimated Time:** 2 hours

Configure automated batch runs every 30 minutes with job deduplication.

---

### Phase 4: Testing & Validation (Days 6-7)

#### Task 4.1: Unit Tests
**Priority:** High  
**Estimated Time:** 4 hours

Test coverage for:
- Prompt template rendering
- LLM response parsing
- Data fusion logic
- Database upsert operations

#### Task 4.2: Integration Tests
**Priority:** High  
**Estimated Time:** 3 hours

End-to-end tests:
- Mock LLM API responses
- Verify database state after batch run
- Test retry and fallback mechanisms

---


This implementation plan provides:

✅ **Complete SQL schema** with indexes and constraints  
✅ **Production-ready LLM service** with retry logic and validation  
✅ **Few-shot prompt template** tailored for Arabic sales context  
✅ **Data fusion pipeline** merging ML + CRM data  
✅ **FastAPI endpoints** for single and batch processing  
✅ **Testing framework** for validation  

**Estimated Sprint 4 Duration:** 7 days with 1 developer

**Critical Path:** Prompt Template (Day 2) → LLM Service (Day 4) → Batch Integration (Day 6)