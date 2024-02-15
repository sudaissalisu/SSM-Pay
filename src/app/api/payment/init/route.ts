import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // ⚠️ Hardcoded Public Key for debugging, based on previous steps
  const ZAINPAY_PUBLIC_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL3phaW5wYXkubmciLCJpYXQiOjE3MjY4MjkxMDcsImlkIjoiNWFkN2FjYzAtN2JiZC00NjM0LWFiNjQtYWY5YzA0NDAwMjdjIiwibmFtZSI6c3VkYWlzc2FsaXN1dUBnbWFpbC5jb20iLCJyb2xlIjpzdWRhaXNzYWxpc3V1QGdtYWlsLmNvbSIsInNlY3JldEtleSI6IndjbHNoWVlTYkJXd1hDZXNSTTZyRDEyc2VkWFROU21scUY3WlVseHl0TXNHSWYifS5nMi1rV3FFYmtfSjV4QmlHOFMyeWZRSTd6RkpCR0gzS2wwcjczRXVWZDFr";
  
  try {
    const formData = await request.json();
    
    // --- Hardcoded Values (FIXED: Removed Markdown link syntax) ---
    // The URLs are now clean string variables.
    const baseUrl = "https://ssm-pay-57sw.vercel.app";
    const ZAINBOX_CODE_NAME = "SSM -_h1PepKlRfdLBzdbdmR5o";
    // -------------------------------------------------------------

    const payload = {
      amount: String(formData.amount),
      mobileNumber: String(formData.mobileNumber),
      emailAddress: String(formData.email),
      currencyCode: String(formData.currency),
      zainboxCode: ZAINBOX_CODE_NAME, 
      callBackUrl: `${baseUrl}/callback`,
      txnRef: `zkit-${Date.now()}`,
      allowRecurringPayment: false, 
      logoUrl: "https://picsum.photos/200/300.jpg",
    };

    // 1. Generate the payload string and log it
    const payloadString = JSON.stringify(payload);
    console.log("PAYLOAD_STRING_FOR_ZAINPAY:", payloadString);

    // ✅ CORRECT ENDPOINT: Using the URL from the official Axios documentation example.
    const API_URL = "https://api.zainpay.ng/v1/merchant/initialize/payment";
    
    const zainpayResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZAINPAY_PUBLIC_KEY}`,
      },
      // Send the stringified payload
      body: payloadString,
    });

    // Get the response as raw text first
    const text = await zainpayResponse.text();
    let result;

    try {
        // Safely attempt to parse the text as JSON
        result = JSON.parse(text);
    } catch (e) {
        // This handles the non-JSON error (e.g., the old "HTTP method not allowed" message)
        console.error("RAW ZAINPAY RESPONSE (Non-JSON):", text);
        return NextResponse.json({ 
            error: "Zainpay returned a non-JSON response. Check your raw logs for details.",
            debugPayloadString: payloadString,
        }, { status: 500 });
    }
    
    // 👇 CRITICAL DIAGNOSTIC LOGGING LINE 👇
    console.error("ZAINPAY API RESPONSE OBJECT:", result); 
    // 👆 CRITICAL DIAGNOSTIC LOGGING LINE 👆

    if (result.code !== "00" || !result.data) {
      // If code is not "00", return the specific error description from Zainpay.
      return NextResponse.json(
        { 
          error: result.description || "Zainpay initialization failed with an unknown error.",
          debugPayloadString: payloadString, 
        }, 
        { status: 400 } // Use 400 for client data/validation errors
      );
    }

    // Success case: return the redirect URL
    return NextResponse.json({ 
      redirectUrl: result.data,
      debugPayloadString: payloadString,
    });
    
  } catch (error: any) {
    console.error("Payment Initialization API Error:", error.message);
    // 3. Catch-all server error response
    return NextResponse.json({ error: error.message || "An unexpected server error occurred." }, { status: 500 });
  }
}
