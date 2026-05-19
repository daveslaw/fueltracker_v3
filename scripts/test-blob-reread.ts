// Tests whether File.arrayBuffer() can be called after a FormData/fetch operation
// Simulates what happens in the pump-photo route when Supabase reads then we base64
import fs from 'fs'

async function main() {
  // Create a File from a real JPEG
  const buf = fs.readFileSync('scripts/pump-test.jpg')
  const blob = new Blob([buf], { type: 'image/jpeg' })
  const file = new File([blob], 'pump.jpg', { type: 'image/jpeg' })

  console.log('Initial size:', file.size)
  
  // Simulate Supabase wrapping in FormData and "sending" it
  const fd = new FormData()
  fd.append('cacheControl', '3600')
  fd.append('', file)
  
  // Convert FormData to a body (simulates what fetch does internally)
  // Just iterate to "consume" it
  const entries = [...fd.entries()]
  console.log('FormData entries:', entries.map(([k]) => k))
  
  // Now try arrayBuffer() like the route does
  const ab = await file.arrayBuffer()
  console.log('arrayBuffer() after FormData wrapping:', ab.byteLength, 'bytes')
  
  // Second call
  const ab2 = await file.arrayBuffer()
  console.log('arrayBuffer() second call:', ab2.byteLength, 'bytes')
  
  if (ab.byteLength === 0) {
    console.error('BUG FOUND: arrayBuffer() returned empty after FormData wrapping')
  } else {
    console.log('File data intact after FormData wrapping')
  }
}

main()
