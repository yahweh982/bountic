import { NextResponse } from "next/server";

import { getSupabaseServerClient, type SupabaseDbClient } from "@/lib/clients/supabase/server";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user?.email) {
    return NextResponse.json({ error: "auth-required" }, { status: 401 });
  }

  const userGithub = user.user_metadata?.user_name ?? user.user_metadata?.preferred_username ?? null;

  const { data: userRecord } = await supabase
    .from("users")
    .select("email, github_username")
    .eq("email", user.email)
    .maybeSingle();

  const fundedBounties = await getFundedBounties(supabase, user.email);
  const wonBounties = userGithub ? await getWonBounties(supabase, userGithub) : [];

  const totalFunded = fundedBounties.reduce((sum, b) => sum + b.total_amount, 0);
  const totalWon = wonBounties.reduce((sum, b) => sum + b.total_amount, 0);

  return NextResponse.json({
    user: {
      email: user.email,
      github_username: userRecord?.github_username ?? userGithub,
    },
    funded_bounties: fundedBounties,
    won_bounties: wonBounties,
    stats: {
      total_funded: totalFunded,
      total_won: totalWon,
      funded_count: fundedBounties.length,
      won_count: wonBounties.length,
    },
  });
}

async function getFundedBounties(supabase: SupabaseDbClient, email: string) {
  const { data: fundingEvents } = await supabase
    .from("funding_events")
    .select("id, issue_id, amount, payment_status, created_at")
    .eq("funder_email", email)
    .eq("payment_status", "SUCCESS")
    .order("created_at", { ascending: false });

  if (!fundingEvents?.length) return [];

  const issueIds = [...new Set(fundingEvents.map((e) => e.issue_id))];
  
  const { data: bounties } = await supabase
    .from("bounties")
    .select("issue_id, status, total_amount, issue_title, issue_url")
    .in("issue_id", issueIds);

  return (bounties ?? []).map((bounty) => {
    const myFunding = fundingEvents
      .filter((e) => e.issue_id === bounty.issue_id)
      .reduce((sum, e) => sum + e.amount, 0);
    
    const parsed = parseIssueId(bounty.issue_id);
    const firstFunding = fundingEvents.find((e) => e.issue_id === bounty.issue_id);
    
    return {
      issue_id: bounty.issue_id,
      owner: parsed?.owner ?? "",
      repo: parsed?.repo ?? "",
      issue_number: parsed?.issueNumber ?? 0,
      issue_title: bounty.issue_title,
      issue_url: bounty.issue_url,
      status: bounty.status,
      total_amount: bounty.total_amount,
      my_funding: myFunding,
      funded_at: firstFunding?.created_at ?? "",
    };
  });
}

async function getWonBounties(supabase: SupabaseDbClient, githubUsername: string) {
  const { data: bounties } = await supabase
    .from("bounties")
    .select("issue_id, status, total_amount, issue_title, issue_url, winning_pr_author, paid_at, payout_tx_hash")
    .eq("winning_pr_author", githubUsername)
    .eq("status", "PAID")
    .order("paid_at", { ascending: false });

  return (bounties ?? []).map((bounty) => {
    const parsed = parseIssueId(bounty.issue_id);
    return {
      issue_id: bounty.issue_id,
      owner: parsed?.owner ?? "",
      repo: parsed?.repo ?? "",
      issue_number: parsed?.issueNumber ?? 0,
      issue_title: bounty.issue_title,
      issue_url: bounty.issue_url,
      status: bounty.status,
      total_amount: bounty.total_amount,
      paid_at: bounty.paid_at,
      tx_hash: bounty.payout_tx_hash,
    };
  });
}

function parseIssueId(issueId: string) {
  const match = /^([^/]+)\/([^#]+)#(\d+)$/.exec(issueId);
  if (!match) return null;
  return { owner: match[1], repo: match[2], issueNumber: parseInt(match[3], 10) };
}