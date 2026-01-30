const express = require('express');
const hubspotService = require('../hubspotService');

const router = express.Router();

const asyncHandler = (operation, handler) => async (req, res, next) => {
  req.operation = operation;
  try {
    const data = await handler(req, res);
    res.json({
      ok: true,
      correlationId: req.correlationId,
      operation,
      data,
    });
  } catch (err) {
    err.operation = err.operation || operation;
    next(err);
  }
};

router.get(
  '/health',
  asyncHandler('health.check', async () => hubspotService.healthCheck())
);

router.post(
  '/contacts/create',
  asyncHandler('contacts.create', async (req) => hubspotService.createContact(req.body.properties || {}))
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const extractBadProperty = (err) => {
  try {
    const body = err.hubspotBody;
    if (!body) return null;
    const msg = typeof body === 'string' ? body : body.message || '';
    const jsonMatch = msg.match(/\[.*\]/s);
    if (jsonMatch) {
      const items = JSON.parse(jsonMatch[0]);
      if (Array.isArray(items) && items.length > 0 && items[0].name) {
        return items[0].name;
      }
    }
    if (body.validationResults) {
      if (Array.isArray(body.validationResults) && body.validationResults.length > 0) {
        return body.validationResults[0].name || null;
      }
    }
  } catch {
    // ignore parse errors
  }
  return null;
};

const createOneWithPropertyRetry = async (createFn, properties) => {
  let remaining = { ...properties };
  const skipped = [];
  const maxAttempts = Object.keys(remaining).length;
  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      const result = await createFn(remaining);
      return {
        status: skipped.length > 0 ? 'warning' : 'created',
        id: result.id,
        skippedFields: skipped.length > 0 ? skipped : undefined,
      };
    } catch (err) {
      const badProp = extractBadProperty(err);
      if (badProp && remaining[badProp] !== undefined && Object.keys(remaining).length > 1) {
        skipped.push(badProp);
        delete remaining[badProp];
        continue;
      }
      return { status: 'failed', error: err.message || 'Create failed' };
    }
  }
  return { status: 'failed', error: 'Exceeded property-removal retries' };
};

const makeBatchHandler = (batchFn, singleFn, operationName) =>
  asyncHandler(operationName, async (req) => {
    const items = req.body.items || [];
    if (items.length === 0) return { results: [] };
    if (items.length > 100) {
      const error = new Error('Batch size must not exceed 100 items');
      error.statusCode = 400;
      throw error;
    }
    const inputs = items.map((item) => ({ properties: item.properties || {} }));
    try {
      const batchResult = await batchFn(inputs);
      return {
        results: (batchResult.results || []).map((r, i) => ({
          index: i,
          status: 'created',
          id: r.id,
        })),
      };
    } catch (batchErr) {
      // Batch failed (validation error etc.) - fall back to individual creates
      const results = [];
      for (let i = 0; i < items.length; i++) {
        if (i > 0 && i % 9 === 0) await sleep(1000);
        const result = await createOneWithPropertyRetry(singleFn, items[i].properties || {});
        results.push({ index: i, ...result });
      }
      return { results };
    }
  });

router.post('/contacts/batch-create', makeBatchHandler(
  hubspotService.batchCreateContacts, hubspotService.createContact, 'contacts.batchCreate'
));

router.post('/companies/batch-create', makeBatchHandler(
  hubspotService.batchCreateCompanies, hubspotService.createCompany, 'companies.batchCreate'
));

router.post('/deals/batch-create', makeBatchHandler(
  hubspotService.batchCreateDeals, hubspotService.createDeal, 'deals.batchCreate'
));

router.get(
  '/contacts/:id',
  asyncHandler('contacts.getById', async (req) => {
    const properties = req.query.properties ? req.query.properties.split(',') : undefined;
    return hubspotService.getContactById(req.params.id, properties);
  })
);

router.post(
  '/contacts/search/email',
  asyncHandler('contacts.searchByEmail', async (req) => hubspotService.searchContactByEmail(req.body.email))
);

router.patch(
  '/contacts/:id',
  asyncHandler('contacts.updateById', async (req) => hubspotService.updateContactById(req.params.id, req.body.properties || {}))
);

router.post(
  '/contacts/upsert',
  asyncHandler('contacts.upsertByEmail', async (req) =>
    hubspotService.upsertContactByEmail(req.body.email, req.body.properties || {})
  )
);

router.get(
  '/contacts',
  asyncHandler('contacts.list', async (req) =>
    hubspotService.listContacts(req.query.limit ? Number(req.query.limit) : 10, req.query.after)
  )
);

router.post(
  '/companies/create',
  asyncHandler('companies.create', async (req) => hubspotService.createCompany(req.body.properties || {}))
);

router.get(
  '/companies/:id',
  asyncHandler('companies.getById', async (req) => {
    const properties = req.query.properties ? req.query.properties.split(',') : undefined;
    return hubspotService.getCompanyById(req.params.id, properties);
  })
);

router.post(
  '/companies/search',
  asyncHandler('companies.search', async (req) =>
    hubspotService.searchCompany({ domain: req.body.domain, name: req.body.name })
  )
);

router.patch(
  '/companies/:id',
  asyncHandler('companies.updateById', async (req) => hubspotService.updateCompanyById(req.params.id, req.body.properties || {}))
);

router.get(
  '/companies',
  asyncHandler('companies.list', async (req) =>
    hubspotService.listCompanies(req.query.limit ? Number(req.query.limit) : 10, req.query.after)
  )
);

router.post(
  '/deals/create',
  asyncHandler('deals.create', async (req) => hubspotService.createDeal(req.body.properties || {}))
);

router.get(
  '/deals/:id',
  asyncHandler('deals.getById', async (req) => {
    const properties = req.query.properties ? req.query.properties.split(',') : undefined;
    return hubspotService.getDealById(req.params.id, properties);
  })
);

router.patch(
  '/deals/:id',
  asyncHandler('deals.updateById', async (req) => hubspotService.updateDealById(req.params.id, req.body.properties || {}))
);

router.get(
  '/deals',
  asyncHandler('deals.list', async (req) =>
    hubspotService.listDeals(req.query.limit ? Number(req.query.limit) : 10, req.query.after)
  )
);

router.post(
  '/associations/contact-company',
  asyncHandler('associations.contactCompany', async (req) =>
    hubspotService.associateContactToCompany({
      contactId: req.body.contactId,
      companyId: req.body.companyId,
      associationTypeId: req.body.associationTypeId,
    })
  )
);

router.post(
  '/associations/deal-contact',
  asyncHandler('associations.dealContact', async (req) =>
    hubspotService.associateDealToContact({
      dealId: req.body.dealId,
      contactId: req.body.contactId,
      associationTypeId: req.body.associationTypeId,
    })
  )
);

router.post(
  '/associations/deal-company',
  asyncHandler('associations.dealCompany', async (req) =>
    hubspotService.associateDealToCompany({
      dealId: req.body.dealId,
      companyId: req.body.companyId,
      associationTypeId: req.body.associationTypeId,
    })
  )
);

router.get(
  '/owners',
  asyncHandler('owners.list', async (req) =>
    hubspotService.listOwners(
      req.query.email,
      req.query.after,
      req.query.limit ? Number(req.query.limit) : 100
    )
  )
);

router.get(
  '/pipelines/deals',
  asyncHandler('pipelines.deals.list', async () => hubspotService.listDealPipelines())
);

router.get(
  '/pipelines/deals/:pipelineId/stages',
  asyncHandler('pipelines.deals.stages', async (req) => hubspotService.listDealPipelineStages(req.params.pipelineId))
);

router.get(
  '/properties/contacts',
  asyncHandler('properties.contacts.list', async () => hubspotService.listProperties('contacts'))
);

router.get(
  '/properties/companies',
  asyncHandler('properties.companies.list', async () => hubspotService.listProperties('companies'))
);

router.get(
  '/properties/deals',
  asyncHandler('properties.deals.list', async () => hubspotService.listProperties('deals'))
);

router.post(
  '/engagements/notes',
  asyncHandler('engagements.notes.create', async (req) => hubspotService.createNote(req.body.properties || {}))
);

router.post(
  '/engagements/tasks',
  asyncHandler('engagements.tasks.create', async (req) => hubspotService.createTask(req.body.properties || {}))
);

router.get(
  '/webhooks/subscriptions',
  asyncHandler('webhooks.list', async () => hubspotService.listWebhooks())
);

module.exports = router;
