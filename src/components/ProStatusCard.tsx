"use client";

export default function ProStatusCard({ me }: { me: any }) {
  const isPro = me?.plan === "PRO";
  const renewDate = me?.usage?.renewAt
    ? new Date(me.usage.renewAt).toLocaleDateString()
    : "-";

  return (
    <div className="rounded-xl border p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">Account Status</h3>
        <span
          className={`px-3 py-1 text-sm rounded-full ${
            isPro ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
          }`}
        >
          {isPro ? "PRO" : "FREE"}
        </span>
      </div>

      <div className="text-sm text-gray-700 space-y-1">
        <div>
          Usage: <b>{me.usage.used}</b> / {me.usage.limit}
        </div>
        <div>Renew: {renewDate}</div>
        <div>
          BYOK: <b>{me.byok_only ? "Required" : "Optional"}</b>
        </div>
      </div>

      {!isPro && (
        <a
          href="/upgrade"
          className="mt-3 block text-center bg-black text-white py-2 rounded-lg hover:opacity-90"
        >
          Upgrade to PRO 🚀
        </a>
      )}
    </div>
  );
}
