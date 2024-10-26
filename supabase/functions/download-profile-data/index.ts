// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
    communityConfig,
    type MetadataUpdateData,
} from "../_citizen-wallet/index.ts";
import { getProfileFromId } from "../_citizen-wallet/contracts/profiles/index.ts";

Deno.serve(async (req) => {
    const { record } = await req.json();

    console.log("record", record);

    if (!record || typeof record !== "object") {
        return new Response("Invalid record data", { status: 400 });
    }

    const { dest, status, data } = record;

    if (!dest || typeof dest !== "string") {
        return new Response(
            "Destination address is required and must be a string",
            { status: 400 },
        );
    }

    const community = communityConfig();

    if (
        dest.toLowerCase() !== community.community.profile.address.toLowerCase()
    ) {
        return new Response("Only process profile updates", {
            status: 200,
        });
    }

    if (status !== "success") {
        return new Response("Transaction status is not success, ignoring", {
            status: 200,
        });
    }

    // Initialize Supabase client with service role key
    const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        },
    );

    const metadataUpdateData = data as MetadataUpdateData;

    // fetch the profile
    const profile = await getProfileFromId(
        community,
        metadataUpdateData._tokenId,
    );

    console.log("profile", profile);

    if (!profile) {
        return new Response("Profile not found, ignore", { status: 200 });
    }

    const result = await supabaseClient
        .from("Profiles")
        .upsert({ ...profile, token_id: metadataUpdateData._tokenId }, {
            onConflict: "account",
        });

    console.log(result);

    if (result.error) {
        console.error(result.error);
    }

    return new Response("notification sent", { status: 200 });
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/notify-successful-transaction' \
    --header 'Authorization: Bearer ' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
