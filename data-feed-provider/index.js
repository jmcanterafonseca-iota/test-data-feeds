import Fastify from "fastify";
import fetch, { Headers } from "node-fetch";

const SERVICE_ENDPOINT = "https://tlip.cmacloudservices.com";
const SERVICE_ROUTE = "/cma-services/rest/events/tlip";

const resultDataFeedTemplate = {
  "@context": ["https://schema.org"],
  type: "DataFeed",
  dataFeedElement: [],
};

function buildDataFeedItem(event) {
  return {
    item: {
      type: event.eventType,
    },
    dateModified: event.eventDate,
  };
}

const getDataFeed = async (request, reply) => {
  // The Authorization header is just propagated to the service
  const authorization = request.headers["authorization"];

  const identifier = request.query["identifier"];

  const headers = new Headers();
  headers.append("Authorization", authorization);

  const url = new URL(`${SERVICE_ENDPOINT}${SERVICE_ROUTE}`);
  const params = url.searchParams;

  params.append("createdDateFrom", "2022-08-02T10:23:50Z");
  params.append("createdDateTo", "2022-08-02T10:33:50Z");
  params.append("UCR", identifier);

  const serviceResponse = await fetch(url, { headers });

  if (serviceResponse.ok) {
    const events = await serviceResponse.json();

    const finalResponse = JSON.parse(JSON.stringify(resultDataFeedTemplate));

    for (const event of events) {
      const item = buildDataFeedItem(event);
      finalResponse.dataFeedElement.push(item);
    }

    finalResponse.dateModified = new Date(Date.now()).toISOString();

    return finalResponse;
  } else {
    throw new Error(
      `The service returned unsuccessful status: ${serviceResponse.status} ${serviceResponse.statusText}`
    );
  }
};

/** Server initialization boilerplate */

const fastify = Fastify({
  logger: true,
});

fastify.get("/", getDataFeed);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

/**
 * Run the server!
 */
const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
