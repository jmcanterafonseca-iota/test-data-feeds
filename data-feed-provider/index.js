import Fastify from "fastify";
import fetch, { Headers } from "node-fetch";

// Needed as the original service seems to be behind a self-signed certificate
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const SERVICE_ENDPOINT = "https://tlip.cmacloudservices.com";
const SERVICE_ROUTE = "/cma-services/rest/events/tlip";

// Template of the data feed as schema.org
const resultDataFeedTemplate = {
  "@context": ["https://schema.org", "https://www.w3.org/ns/activitystreams"],
  type: "DataFeed",
  dataFeedElement: [],
};

function convertLocationToDecimal(event) {
    const latitude = event.latDegree + event.latMinute / 60;
    if (event.latHemisphere === "S") {
        latitude*=-1;
    }

    const longitude = event.longDegree + event.longMinute / 60;
    if (event.longHemishere === "W") {
        longitude *= -1;
    }
    
    return { latitude, longitude };
}

function translateEventType(event) {
    switch(event.eventType) {
        case "CHECKPOINT_ARRIVAL":
            return "ArrivalAction";
        case "LAT_ENTERED_ZONE":
            return "Place";
    }
}

function buildDataFeedItem(event) {
  return {
    item: {
      type: translateEventType(event),
      ...convertLocationToDecimal(event)
    },
    dateModified: event.eventDate,
  };
}

const getDataFeed = async (request, reply) => {
  // The Authorization header is just propagated to the service
  const authorization = request.headers["authorization"];
  const identifier = request.query["identifier"];

  if (!identifier) {
    throw new Error("Identifier query param not supplied");
  }

  // Authorization credentials is just propagated
  const headers = new Headers();
  headers.append("Authorization", authorization);

  const url = new URL(`${SERVICE_ENDPOINT}${SERVICE_ROUTE}`);
  const params = url.searchParams;

  // Hardcoded values that should be tuned later
  params.append("createdDateFrom", "2022-08-02T10:23:50Z");
  params.append("createdDateTo", "2022-08-02T10:33:50Z");

  const elements = identifier.split(":");
  params.append("UCR", elements[elements.length - 1]);

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
