import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, instituteName, email, phone, city, studentCount, notes } = body;

    // Validate required fields
    if (!fullName || !instituteName || !email || !phone || !city) {
      return NextResponse.json(
        { error: "Please fill in all required fields (Name, Institute, Email, Phone, City)." },
        { status: 400 }
      );
    }

    // Phone number validation (Indian 10-digit mobile check)
    const phoneClean = String(phone).replace(/\D/g, "");
    if (phoneClean.length < 10) {
      return NextResponse.json(
        { error: "Please enter a valid 10-digit contact mobile number." },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    // Successfully received demo booking request
    return NextResponse.json({
      success: true,
      message: `Thank you ${fullName}! Your demo request for ${instituteName} (${studentCount || "50+"} students) has been received. Our coaching solutions team will contact you within 2 business hours.`,
      requestId: `demo-${Date.now()}`,
      studentCount,
      notes,
    });
  } catch (error) {
    console.error("Error processing demo request:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
