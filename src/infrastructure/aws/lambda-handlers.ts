import 'reflect-metadata';

interface LambdaEvent {
  body?: string;
  isBase64Encoded?: boolean;
  pathParameters?: Record<string, string>;
}

interface LambdaResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

/** AWS Lambda handler for PDF extraction pipeline */
export const pdfExtractionHandler = async (event: LambdaEvent): Promise<LambdaResponse> => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No PDF data provided' }),
        headers: CORS_HEADERS,
      };
    }

    const pdfBuffer = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'PDF extraction triggered', size: pdfBuffer.length }),
      headers: CORS_HEADERS,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      statusCode: 500,
      body: JSON.stringify({ error: message }),
      headers: CORS_HEADERS,
    };
  }
};

/** AWS Lambda handler for API sync jobs */
export const apiSyncHandler = async (event: LambdaEvent): Promise<LambdaResponse> => {
  try {
    const dataSourceId = event.pathParameters?.dataSourceId;
    if (!dataSourceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'dataSourceId is required' }),
        headers: CORS_HEADERS,
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'API sync triggered', dataSourceId }),
      headers: CORS_HEADERS,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      statusCode: 500,
      body: JSON.stringify({ error: message }),
      headers: CORS_HEADERS,
    };
  }
};
