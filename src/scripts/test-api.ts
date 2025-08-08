// Script per testare le API routes
// Eseguire con: npx ts-node src/scripts/test-api.ts

const API_BASE = 'http://localhost:3000/api'

async function testCreateRoom() {
  console.log('🧪 Testing Room Creation...')
  
  const testData = {
    participants: [
      { name: 'Mario Rossi', budget: 500 },
      { name: 'Luigi Verdi', budget: 500 }
    ],
    players: [
      { name: 'Cristiano Ronaldo', role: 'A', price: 50 },
      { name: 'Lionel Messi', role: 'A', price: 45 }
    ]
  }

  try {
    const response = await fetch(`${API_BASE}/rooms/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    })
    
    const result = await response.json()
    console.log('✅ Room created:', result)
    return result
  } catch (error) {
    console.error('❌ Room creation failed:', error)
  }
}

async function testStartAuction(roomId: string) {
  console.log('🧪 Testing Auction Start...')
  
  try {
    const response = await fetch(`${API_BASE}/auction/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, timeLimit: 60 })
    })
    
    const result = await response.json()
    console.log('✅ Auction started:', result)
    return result
  } catch (error) {
    console.error('❌ Auction start failed:', error)
  }
}

async function testPlaceBid(participantId: string, playerId: string, amount: number) {
  console.log('🧪 Testing Bid Placement...')
  
  try {
    const response = await fetch(`${API_BASE}/bids/place`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, playerId, amount })
    })
    
    const result = await response.json()
    console.log('✅ Bid placed:', result)
    return result
  } catch (error) {
    console.error('❌ Bid placement failed:', error)
  }
}

async function runTests() {
  console.log('🚀 Starting API Tests...\n')
  
  // Test 1: Create Room
  const roomResult = await testCreateRoom()
  if (!roomResult?.success) return
  
  const { roomId, participants } = roomResult
  
  // Test 2: Start Auction
  const auctionResult = await testStartAuction(roomId)
  if (!auctionResult?.success) return
  
  const { playerId } = auctionResult
  
  // Test 3: Place Bids
  await testPlaceBid(participants[0].id, playerId, 25)
  await testPlaceBid(participants[1].id, playerId, 30)
  
  console.log('\n🎉 All tests completed!')
}

runTests().catch(console.error)