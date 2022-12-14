const { Shopify } = require("@shopify/shopify-api")
const fetch = require("node-fetch")

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
}

require('dotenv').config()

const customerQueryStringForFirstPage = `query GetCustomers {
    customers(first:250, query: "state:invited OR state:disabled") {
    edges {
      node {
        id
        email
        tags
        state
      }
    }
    pageInfo {
      endCursor
      hasNextPage
    }
  }
}`
const customerQueryString = `query GetCustomers($after: String!) {
    customers(first: 250, after: $after, query: "state:invited OR state:disabled") {
    edges {
      node {
        id
        email
        tags
        state
      }
    }
    pageInfo {
      endCursor
      hasNextPage
    }
  }
}`

const adminAccessToken = process.env.API_PASSWORD
const shop = process.env.STORE_NAME
const api_key = process.env.API_KEY
const api_version = process.env.API_VERSION

const client = new Shopify.Clients.Graphql(
    shop,
    adminAccessToken
)

// Shopify REST admin API URL
const baseUrl = `https://${api_key}:${adminAccessToken}@${shop}/admin/api/${api_version}`

const queryEmailCustomers = async () => {
    let after = ''
    let hasNextPage = true
    let allCustomers = []
  
    while(hasNextPage) {
      try {
        const result = await client.query({
          data: {
            query: after ? customerQueryString : customerQueryStringForFirstPage,
            variables: {
              after: after
            }
          },
        })
        
        hasNextPage = result?.body?.data?.customers?.pageInfo?.hasNextPage
        after = result?.body?.data?.customers?.pageInfo?.endCursor || ''
        const customers = result?.body?.data?.customers?.edges || []
        allCustomers = allCustomers.concat(customers)
        
        console.log('[Querying un-activated customers]', customers.length)
      }
      catch (err) {
        // console.log('[error]', err.message)
        continue
      }
    }
  
    console.log('[Number of un-activated customers]', allCustomers.length)
  
    return allCustomers
}

const timer = ms => new Promise(res => setTimeout(res, ms))

const handler = async () => {
    // const method = event.httpMethod;
    const method = 'POST';

    switch (method) {
        case 'POST':
            try {
                const allCustomers = await queryEmailCustomers()

                for(let i = 0; i < allCustomers.length; i++) {
                    const customer = allCustomers[i].node
                    console.log('[STATE]', customer.state)
                    const customerGlobalId = customer.id
                    const customerId = customerGlobalId.split('/').reverse()[0]

                    const endpoint = `${baseUrl}/customers/${customerId}/send_invite.json`
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    })
                    const result = await response.json()
                    console.log('[Account invite - ' + i + ']', result)

                    if (i > 99 && i % 100 === 0) {
                      await timer(10 * 60 * 1000)
                    }
                }

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(allCustomers)
                }
            } catch (error) {
                return {
                    statusCode: 500,
                    headers,
                    body: error.toString()
                }
            }
        case 'OPTIONS':
            return {
                statusCode: 200,
                headers
            }
        default:
            return {
                statusCode: 500,
                headers,
                body: 'Only HTTP POST method is allowed'
            }
    }
}

// module.exports = { handler }
handler()
