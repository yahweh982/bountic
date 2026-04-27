import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { getSupabaseServerClient } from "@/lib/clients/supabase/server"
import Image from "next/image"
import Link from "next/link";
import CheckoutButton from "./checkout-button";

export default async function MockCheckoutPage({
    params
}: {
    params: Promise<{ checkoutId: string }>
}) {
    const { checkoutId } = await params
    
    const supabase = await getSupabaseServerClient();

    const { data: session, error } = await supabase
        .from("funding_events")
        .select("*, bounties(issue_url)")
        .eq("locus_checkout_id", checkoutId)
        .single()

    if (error) {
        console.error("Error fetching session:", error)
        return (
            <div className="p-4 flex flex-col items-center gap-4">
                <Image className="invert h-auto" src="/locus-logo.webp" alt="Locus Logo" width={200} height={200} />

                <h1>Error Fetching Checkout Session</h1>
                <p>There was an error fetching the checkout session with ID: {checkoutId}</p>
                
                <Image className="invert" src="/locus-secure.webp" alt="Secured by Locus" width={200} height={50} />
            </div>
        )
    }

    if (!session) {
        return (
            <div className="p-4 flex flex-col items-center gap-4">
                <Image className="invert h-auto" src="/locus-logo.webp" alt="Locus Logo" width={200} height={200} />

                <h1>Checkout Session Not Found</h1>
                <p>We couldn't find the checkout session with ID: {checkoutId}</p>
                
                <Image className="invert" src="/locus-secure.webp" alt="Secured by Locus" width={200} height={50} />
            </div>
        )
    }

    return (
        <div className="p-4 flex flex-col items-center gap-4">
            <Image className="invert h-auto" src="/locus-logo.webp" alt="Locus Logo" width={120} height={120} />

            <Card className="w-full max-w-md">
                <CardHeader>
                    <h3 className="text-lg font-bold">
                        Mock Checkout Session
                    </h3>
                </CardHeader>
                <CardContent>
                    {/* <p className="mb-2">Session ID: {session.id}</p> */}
                    <p className="mb-2">Funder: {session.funder_display_name || "Anonymous"}</p>
                    <p className="mb-2">Amount: ${session.amount}</p>
                    <p className="mb-2">Status: {session.payment_status}</p>
                    {session.bounties && session.bounties.issue_url && (
                        <p className="mb-2">Issue URL: <Link href={session.bounties.issue_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">{session.bounties.issue_url}</Link></p>
                    )}
                </CardContent>
                <CardFooter>
                    {session.payment_status === "SUCCESS" ? (
                        <p className="text-green-600 font-semibold">Payment Successful</p>
                    ) : (
                        <CheckoutButton issueId={session.issue_id} checkoutSessionId={checkoutId} />
                    )}
                </CardFooter>
            </Card>
        </div>
    )
}