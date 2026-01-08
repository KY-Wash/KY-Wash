import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { InfoIcon } from "lucide-react";
import { FetchDataSteps } from "@/components/tutorial/fetch-data-steps";
import { Suspense } from "react";
import Link from "next/link";

async function UserDetails() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return JSON.stringify(data.claims, null, 2);
}

export default function ProtectedPage() {
  return (
    <div className="flex-1 w-full flex flex-col gap-12">
      <div className="w-full">
        <div className="bg-accent text-sm p-3 px-5 rounded-md text-foreground flex gap-3 items-center">
          <InfoIcon size="16" strokeWidth={2} />
          This is a protected page that you can only see as an authenticated
          user
        </div>
      </div>
      
      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-2xl">Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/machines"
            className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            <h3 className="font-semibold mb-2">Machine Management</h3>
            <p className="text-sm text-gray-600">Monitor and control washing machines and dryers in real-time</p>
          </Link>
          
          <Link
            href="/analytics"
            className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            <h3 className="font-semibold mb-2">Analytics Dashboard</h3>
            <p className="text-sm text-gray-600">View machine usage statistics, queue times, and peak hours</p>
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-2 items-start">
        <h2 className="font-bold text-2xl mb-4">Your user details</h2>
        <pre className="text-xs font-mono p-3 rounded border max-h-32 overflow-auto">
          <Suspense>
            <UserDetails />
          </Suspense>
        </pre>
      </div>
      <div>
        <h2 className="font-bold text-2xl mb-4">Next steps</h2>
        <FetchDataSteps />
      </div>
    </div>
  );
}
