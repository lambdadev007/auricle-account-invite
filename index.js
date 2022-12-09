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
    customers(first:250, query: "tag:password-page") {
    edges {
      node {
        id
        email
        tags
      }
    }
    pageInfo {
      endCursor
      hasNextPage
    }
  }
}`
const customerQueryString = `query GetCustomers($after: String!) {
    customers(first: 250, after: $after, query: "tag:password-page") {
    edges {
      node {
        id
        email
        tags
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
        
        console.log('[queryWholesaleCustomers]', customers.length)
      }
      catch (err) {
        // console.log('[error]', err.message)
        continue
      }
    }
  
    console.log('[allCustomers]', allCustomers.length)
  
    return allCustomers
}

const handler = async () => {
    // const method = event.httpMethod;
    const method = 'POST';

    switch (method) {
        case 'POST':
            try {
                const allCustomers = await queryEmailCustomers()
                console.log('[allCustomers]', allCustomers)

                for(let i = 0; i < allCustomers.length; i++) {
                    const customer = allCustomers[i].node
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
                    console.log('[Account invite]', result)
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
