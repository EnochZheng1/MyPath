// backend/services/difyService.js

const fetch = require('node-fetch'); // <-- THIS IS THE REQUIRED LINE

/**
 * A reusable function to call any Dify workflow.
 * @param {string} workflowUrl - The URL of the Dify workflow endpoint.
 * @param {string} apiKey - The Dify API key for authorization.
 * @param {object} body - The full request body to be sent to Dify.
 * @returns {Promise<object>} - The JSON response from the Dify workflow.
 */
const callDifyWorkflow = async (workflowUrl, apiKey, body) => {
  try {
    const response = await fetch(workflowUrl, { // This will now work
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Dify API responded with status ${response.status}: ${errorBody}`);
    }

    return await response.json();

  } catch (error) {
    console.error('Error calling Dify workflow:', error);
    throw error;
  }
};

module.exports = { callDifyWorkflow };