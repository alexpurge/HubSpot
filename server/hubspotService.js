const hubspotClient = require('./hubspotClient');

const ensureToken = (operation) => {
  if (!process.env.HUBSPOT_PRIVATE_APP_TOKEN) {
    const error = new Error('HUBSPOT_PRIVATE_APP_TOKEN is required');
    error.operation = operation;
    error.details = { stage: 'validate-token' };
    throw error;
  }
};

const sanitizeResponse = (data) => JSON.parse(JSON.stringify(data));

const wrapHubspotError = (operation, stage, err) => {
  const error = new Error(err.message || 'HubSpot request failed');
  error.operation = operation;
  error.details = { stage };
  error.hubspotStatus = err.response?.statusCode ?? null;
  error.hubspotBody = err.response?.body ?? err.body ?? null;
  return error;
};

const listContacts = async (limit = 10, after = undefined) => {
  const operation = 'contacts.list';
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.contacts.basicApi.getPage(limit, after);
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, 'list-contacts', err);
  }
};

const createContact = async (properties) => {
  const operation = 'contacts.create';
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.contacts.basicApi.create({ properties });
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, 'create-contact', err);
  }
};

const getContactById = async (contactId, properties = undefined) => {
  const operation = 'contacts.getById';
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.contacts.basicApi.getById(contactId, properties);
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, 'get-contact', err);
  }
};

const searchContactByEmail = async (email) => {
  const operation = 'contacts.searchByEmail';
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.contacts.searchApi.doSearch({
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'email',
              operator: 'EQ',
              value: email,
            },
          ],
        },
      ],
      limit: 10,
    });
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, 'search-contact-email', err);
  }
};

const updateContactById = async (contactId, properties) => {
  const operation = 'contacts.updateById';
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.contacts.basicApi.update(contactId, { properties });
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, 'update-contact', err);
  }
};

const upsertContactByEmail = async (email, properties = {}) => {
  const operation = 'contacts.upsertByEmail';
  ensureToken(operation);
  try {
    const searchResults = await hubspotClient.crm.contacts.searchApi.doSearch({
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'email',
              operator: 'EQ',
              value: email,
            },
          ],
        },
      ],
      limit: 1,
    });

    if (searchResults.results && searchResults.results.length > 0) {
      const contactId = searchResults.results[0].id;
      const updated = await hubspotClient.crm.contacts.basicApi.update(contactId, {
        properties: { ...properties, email },
      });
      return sanitizeResponse({
        action: 'updated',
        result: updated,
      });
    }

    const created = await hubspotClient.crm.contacts.basicApi.create({
      properties: { ...properties, email },
    });

    return sanitizeResponse({
      action: 'created',
      result: created,
    });
  } catch (err) {
    throw wrapHubspotError(operation, 'upsert-contact', err);
  }
};

const listCompanies = async (limit = 10, after = undefined) => {
  const operation = 'companies.list';
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.companies.basicApi.getPage(limit, after);
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, 'list-companies', err);
  }
};

const createCompany = async (properties) => {
  const operation = 'companies.create';
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.companies.basicApi.create({ properties });
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, 'create-company', err);
  }
};

const getCompanyById = async (companyId, properties = undefined) => {
  const operation = 'companies.getById';
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.companies.basicApi.getById(companyId, properties);
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, 'get-company', err);
  }
};

const searchCompany = async ({ domain, name }) => {
  const operation = 'companies.search';
  ensureToken(operation);
  const filters = [];
  if (domain) {
    filters.push({ propertyName: 'domain', operator: 'EQ', value: domain });
  }
  if (name) {
    filters.push({ propertyName: 'name', operator: 'CONTAINS_TOKEN', value: name });
  }
  try {
    const response = await hubspotClient.crm.companies.searchApi.doSearch({
      filterGroups: filters.length
        ? [
            {
              filters,
            },
          ]
        : [],
      limit: 10,
    });
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, 'search-company', err);
  }
};

const updateCompanyById = async (companyId, properties) => {
  const operation = 'companies.updateById';
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.companies.basicApi.update(companyId, { properties });
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, 'update-company', err);
  }
};

const listDeals = async (limit = 10, after = undefined) => {
  const operation = 'deals.list';
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.deals.basicApi.getPage(limit, after);
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, 'list-deals', err);
  }
};

const createDeal = async (properties) => {
  const operation = 'deals.create';
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.deals.basicApi.create({ properties });
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, 'create-deal', err);
  }
};

const getDealById = async (dealId, properties = undefined) => {
  const operation = 'deals.getById';
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.deals.basicApi.getById(dealId, properties);
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, 'get-deal', err);
  }
};

const updateDealById = async (dealId, properties) => {
  const operation = 'deals.updateById';
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.deals.basicApi.update(dealId, { properties });
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, 'update-deal', err);
  }
};

const ASSOCIATION_TYPE_IDS = {
  contactCompany: 279,
  dealContact: 4,
  dealCompany: 5,
};

const associateObjects = async ({ fromObjectType, fromObjectId, toObjectType, toObjectId, associationTypeId, operation, stage }) => {
  ensureToken(operation);
  try {
    const spec = [
      {
        associationCategory: 'HUBSPOT_DEFINED',
        associationTypeId,
      },
    ];
    const response = await hubspotClient.crm.associations.v4.basicApi.create(
      fromObjectType,
      fromObjectId,
      toObjectType,
      toObjectId,
      spec
    );
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, stage, err);
  }
};

const associateContactToCompany = async ({ contactId, companyId, associationTypeId }) => {
  const operation = 'associations.contactCompany';
  const typeId = associationTypeId || ASSOCIATION_TYPE_IDS.contactCompany;
  return associateObjects({
    fromObjectType: 'contacts',
    fromObjectId: contactId,
    toObjectType: 'companies',
    toObjectId: companyId,
    associationTypeId: typeId,
    operation,
    stage: 'associate-contact-company',
  });
};

const associateDealToContact = async ({ dealId, contactId, associationTypeId }) => {
  const operation = 'associations.dealContact';
  const typeId = associationTypeId || ASSOCIATION_TYPE_IDS.dealContact;
  return associateObjects({
    fromObjectType: 'deals',
    fromObjectId: dealId,
    toObjectType: 'contacts',
    toObjectId: contactId,
    associationTypeId: typeId,
    operation,
    stage: 'associate-deal-contact',
  });
};

const associateDealToCompany = async ({ dealId, companyId, associationTypeId }) => {
  const operation = 'associations.dealCompany';
  const typeId = associationTypeId || ASSOCIATION_TYPE_IDS.dealCompany;
  return associateObjects({
    fromObjectType: 'deals',
    fromObjectId: dealId,
    toObjectType: 'companies',
    toObjectId: companyId,
    associationTypeId: typeId,
    operation,
    stage: 'associate-deal-company',
  });
};

const listOwners = async (email = undefined, after = undefined, limit = 100) => {
  const operation = 'owners.list';
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.owners.ownersApi.getPage(email, after, limit);
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, 'list-owners', err);
  }
};

const listDealPipelines = async () => {
  const operation = 'pipelines.deals.list';
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.pipelines.pipelinesApi.getAll('deals');
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, 'list-deal-pipelines', err);
  }
};

const listDealPipelineStages = async (pipelineId) => {
  const operation = 'pipelines.deals.stages';
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.pipelines.pipelinesApi.getById('deals', pipelineId);
    return sanitizeResponse(response.stages || response);
  } catch (err) {
    throw wrapHubspotError(operation, 'list-deal-stages', err);
  }
};

const listProperties = async (objectType) => {
  const operation = `properties.${objectType}.list`;
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.properties.coreApi.getAll(objectType);
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, `list-properties-${objectType}`, err);
  }
};

const createNote = async (properties) => {
  const operation = 'engagements.notes.create';
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.objects.notes.basicApi.create({ properties });
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, 'create-note', err);
  }
};

const createTask = async (properties) => {
  const operation = 'engagements.tasks.create';
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.objects.tasks.basicApi.create({ properties });
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, 'create-task', err);
  }
};

const listWebhooks = async () => {
  const operation = 'webhooks.list';
  const error = new Error('Webhook subscriptions require OAuth-based public apps and are not supported with private app tokens.');
  error.operation = operation;
  error.details = { stage: 'oauth-required' };
  error.statusCode = 400;
  throw error;
};

const healthCheck = async () => {
  const operation = 'health.check';
  ensureToken(operation);
  try {
    const response = await hubspotClient.crm.contacts.basicApi.getPage(1, undefined);
    return sanitizeResponse(response);
  } catch (err) {
    throw wrapHubspotError(operation, 'health-check', err);
  }
};

module.exports = {
  listContacts,
  createContact,
  getContactById,
  searchContactByEmail,
  updateContactById,
  upsertContactByEmail,
  listCompanies,
  createCompany,
  getCompanyById,
  searchCompany,
  updateCompanyById,
  listDeals,
  createDeal,
  getDealById,
  updateDealById,
  associateContactToCompany,
  associateDealToContact,
  associateDealToCompany,
  listOwners,
  listDealPipelines,
  listDealPipelineStages,
  listProperties,
  createNote,
  createTask,
  listWebhooks,
  healthCheck,
};
