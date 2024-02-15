import { redirect } from 'next/navigation';

export async function POST(req: Request) {
    // ⚠️ WARNING: Hardcoding the Public Key is a security risk.
    const ZAINPAY_PUBLIC_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL3phaW5wYXkubmciLCJpYXQiOjE3MjY4MjkxMDcsImlkIjoiNWFkN2FjYzAtN2JiZC00NjM0LWFiNjQtYWY5YzA0NDAwMjdjIiwibmFtZSI6c3VkYWlzc2FsaXN1dUBnbWFpbC5jb20iLCJyb2xlIjpzdWRhaXNzYWxpc3V1QGdtYWlsLmNvbSIsInNlY3JldEtleSI6IndjbHNoWVlTYkJXd1hDZXNSTTZyRDEyc0VkWFROU21scUY3WlVseHl0TXNHSWYifS5nMi1rV3FFYmtfSjV4QmlHOFMyeWZRSTd6RkpCR0gzS2wwcjczRXVWZDFr";

    try {
        const body = await req.json();

        const zainpayResponse = await fetch(
            "https://api.zainpay.ng/zainbox/card/initialize/payment",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // HARDCODED THE KEY HERE
                    "Authorization": `Bearer ${ZAINPAY_PUBLIC_KEY}`,
                },
                body: JSON.stringify(body),
            }
        );

        const text = await zainpayResponse.text();

        let result;
        try {
            // Attempt to parse the response text as JSON
            result = JSON.parse(text);
        } catch {
            // If JSON parsing fails (e.g., receives "Unexpected token 'H'"),
            // log the raw response text and return a specific error.
            console.error("RAW ZAINPAY RESPONSE:", text);
            return Response.json({ error: "Zainpay returned non-JSON response: " + text }, { status: 500 });
        }
        
        if (result.code !== "00" || !result.data) {
             return Response.json({ error: result.description || "Failed to initialize payment." }, { status: 400 });
        }

        return Response.json(result);

    } catch (err: any) {
        console.error("Initialize payment error:", err);
        return Response.json(
            { error: "Server error", details: err.message },
            { status: 500 }
        );
    }
}
