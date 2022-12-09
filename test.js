const fetch = require("node-fetch")
const { Shopify } = require("@shopify/shopify-api")

require('dotenv').config()

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
}

const giftCardsQueryStringForFirstPage = `query GetGiftcards {
      giftCards(first: 250) {
      edges {
        node {
          id
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }`
const giftCardsQueryString = `query GetGiftcards($after: String!) {
      giftCards(after: $after, first: 250) {
      edges {
        node {
          id
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }`

const customerQueryStringForFirstPage = `query GetCustomers {
      customers(first:250, query: "tag:wholesale-customer") {
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
      customers(first: 250, after: $after, query: "tag:wholesale-customer") {
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

const adminAccessToken = process.env.HC_APP_PASSWORD
const shop = process.env.HC_STORE
const api_key = process.env.HC_APP_KEY
const api_version = process.env.HC_API_VERSION

// Shopify REST admin API URL
const baseUrl = `https://${api_key}:${adminAccessToken}@${shop}/admin/api/${api_version}`

const client = new Shopify.Clients.Graphql(
    shop,
    adminAccessToken
)

const queryGiftCards = async () => {
    let after = ''
    let hasNextPage = true
    let allGiftCards = []
  
    while(hasNextPage) {
      try {
        const giftCardsQueryResult = await client.query({
          data: {
            query: after ? giftCardsQueryString : giftCardsQueryStringForFirstPage,
            variables: {
              after: after
            }
          },
        })
        
        hasNextPage = giftCardsQueryResult?.body?.data?.giftCards?.pageInfo?.hasNextPage
        after = giftCardsQueryResult?.body?.data?.giftCards?.pageInfo?.endCursor || ''
        const giftCards = giftCardsQueryResult?.body?.data?.giftCards?.edges || []
        allGiftCards = allGiftCards.concat(giftCards)
        
        console.log('[giftCardsQueryResult]', giftCardsQueryResult?.body?.errors)
      }
      catch (err) {
        console.log('[error]', err.message)
        continue
      }
    }
  
    console.log('[allGiftCards]', allGiftCards.length)
  
    return allGiftCards
}
  
const queryWholesaleCustomers = async () => {
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
        console.log('[error]', err.message)
        continue
      }
    }
  
    console.log('[allCustomers]', allCustomers.length)
  
    return allCustomers
}
  
const getWholesaleCustomers = async () => {
    const url = `${baseUrl}/customers/search.json?query=tag:wholesale-customer&fields=id, email, tags, first_name, last_name&limit=250`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    const result = await response.json()
    console.log('[queryWholesaleCustomers]', result.customers.length)
  
    return result
}
  
const searchGiftcardPerCustomer = async (email) => {
    const url = `${baseUrl}/gift_cards/search.json?query=email:${email}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    const result = await response.json()
    console.log('[searchGiftcardPerCustomer]', result.gift_cards.length)
  
    return result.gift_cards
  }
  
  const tagCustomer = async (customerId, customerTags, tag) => {
    const url = `${baseUrl}/customers/${customerId}.json`
    customerTags.push(tag)
    const newTags = customerTags
    // console.log('[newTags]', newTags)
  
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "customer": {
          "tags": newTags.join(',')
        }
      })
    })
    const result = await response.json()
    // console.log('[tagCustomer]', result)
  
    return result
}

const handler = async () => {
    try {
      const wholesaleCustomers = await queryWholesaleCustomers()
  
      for(let j = 0; j < wholesaleCustomers.length; j++) {
        const customer = wholesaleCustomers[j].node
        // console.log('[customer]', customer)
  
        const customerGlobalId = customer.id
        const customerId = customerGlobalId.split('/').reverse()[0]
        const customerTags = customer.tags
        const newTags = [
          'wholesale-newgiftcard',
          'wholesale-usedgiftcard',
          'wholesale-depletedgiftcard'
        ]
        for(let k = 0; k < newTags.length; k++) {
          const index = customerTags.indexOf(newTags[k])
          if (index > -1) customerTags.splice(index, 1)
        }

        const customerEmail = customer.email
        const giftCards = await searchGiftcardPerCustomer(customerEmail)
        
        for(let i = 0; i < giftCards.length; i++) {
          const giftCard = giftCards[i]
          if (giftCard.initial_value === giftCard.balance) {
            await tagCustomer(customerId, customerTags, 'wholesale-newgiftcard')
          }
          else if (giftCard.initial_value !== giftCard.balance && giftCard.balance > 0) {
            await tagCustomer(customerId, customerTags, 'wholesale-usedgiftcard')
          }
          else if (giftCard.balance === "0.00") {
            await tagCustomer(customerId, customerTags, 'wholesale-depletedgiftcard')
          }
        }
      }
  
      console.log('[All done]')
      return "All done"
    } catch (error) {
      console.log('[error]', error)
      return error
    }
}

handler()