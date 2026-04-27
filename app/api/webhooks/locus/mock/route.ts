import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseServiceClient } from "@/lib/clients/supabase/server";
import { handleLocusFundingWebhook } from "@/lib/bounty/handlers";
import { getLocusServerEnv } from "@/lib/env/server";

type MockWebhookBody = {
  sessionId: string;
};

export async function POST(request: NextRequest) {
  const env = getLocusServerEnv();

  if (!env.LOCUS_MOCK) {
    return NextResponse.json({ error: "mock-disabled" }, { status: 403 });
  }

  let body: MockWebhookBody;

  try {
    body = (await request.json()) as MockWebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid-json-body" }, { status: 400 });
  }

  if (!body.sessionId) {
    return NextResponse.json({ error: "missing-session-id" }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();
  const { data: fundingEvent, error: lookupError } = await supabase
    .from("funding_events")
    .select("locus_checkout_id")
    .eq("locus_checkout_id", body.sessionId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "lookup-failed", message: lookupError.message }, { status: 500 });
  }

  if (!fundingEvent) {
    return NextResponse.json({ error: "unknown-session" }, { status: 404 });
  }

  const payload = {
    event: "checkout.session.paid",
    data: {
      sessionId: body.sessionId,
      checkout_session_id: body.sessionId,
    },
  };

  try {
    const result = await handleLocusFundingWebhook(payload);
    return NextResponse.json({ success: true, ...result });
  } catch (handlerError) {
    return NextResponse.json(
      { error: "handler-failed", message: String(handlerError) },
      { status: 500 },
    );
  }
}
