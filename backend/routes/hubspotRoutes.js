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
