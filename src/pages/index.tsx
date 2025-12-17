import Head from "next/head";
import { DocumentTextIcon, CogIcon } from "@heroicons/react/24/outline";
import { AgentCard } from "@/components/AgentCard";

export default function Home() {
  return (
    <>
      <Head>
        <title>SIA Agents</title>
        <meta name="description" content="SIA Agents" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex min-h-screen bg-gray-50">
        {/* Sidebar */}
        <div className="w-56 bg-gray-100 p-5">
          {/* Logo */}
          <div className="mb-8">
            <img src="/assets/sia.png" alt="SIA Logo" className="h-8 w-auto" />
          </div>

          {/* Favorites */}
          <div className="mb-2 flex cursor-pointer items-center justify-between rounded-md p-2 hover:bg-gray-200">
            <div className="flex items-center">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="mr-2"
              >
                <path
                  d="M7.68335 1.53C7.71257 1.47097 7.7577 1.42129 7.81365 1.38655C7.86961 1.35181 7.93416 1.3334 8.00002 1.3334C8.06588 1.3334 8.13043 1.35181 8.18639 1.38655C8.24234 1.42129 8.28747 1.47097 8.31669 1.53L9.85669 4.64933C9.95814 4.85465 10.1079 5.03223 10.2931 5.16697C10.4783 5.30167 10.6934 5.38941 10.92 5.42267L14.364 5.92667C14.4293 5.93612 14.4906 5.96365 14.541 6.00613C14.5914 6.04862 14.629 6.10437 14.6494 6.16707C14.6698 6.22978 14.6722 6.29694 14.6564 6.36096C14.6406 6.42498 14.6072 6.48333 14.56 6.52933L12.0694 8.95467C11.9051 9.11473 11.7822 9.31232 11.7112 9.53042C11.6403 9.74852 11.6234 9.98059 11.662 10.2067L12.25 13.6333C12.2615 13.6986 12.2545 13.7657 12.2297 13.8271C12.2049 13.8885 12.1633 13.9417 12.1097 13.9807C12.0561 14.0196 11.9927 14.0427 11.9266 14.0473C11.8605 14.0519 11.7945 14.0378 11.736 14.0067L8.65735 12.388C8.4545 12.2815 8.22881 12.2258 7.99997 12.2258C7.77113 12.2258 7.54544 12.2815 7.34259 12.388L4.26402 14.0067C4.20557 14.0376 4.13962 14.0515 4.07365 14.0468C4.00769 14.0421 3.94437 14.019 3.89088 13.9801C3.8374 13.9413 3.79591 13.8881 3.77112 13.8268C3.74634 13.7655 3.73926 13.6985 3.75069 13.6333L4.33802 10.2073C4.37682 9.98116 4.36001 9.74893 4.28905 9.5307C4.21808 9.31246 4.09509 9.11477 3.93069 8.95467L1.44002 6.53C1.39242 6.48402 1.35868 6.4256 1.34266 6.36138C1.32664 6.29717 1.32898 6.22975 1.34941 6.16679C1.36983 6.10384 1.40753 6.04789 1.4582 6.00532C1.50888 5.96275 1.57049 5.93527 1.63602 5.926L5.07935 5.42267C5.30619 5.38967 5.52161 5.30204 5.70708 5.16733C5.89254 5.03261 6.04249 4.85485 6.14402 4.64933L7.68335 1.53Z"
                  stroke="#020817"
                  strokeWidth="1.33333"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-sm text-gray-700">Favorites</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 12L10 8L6 4"
                stroke="#020817"
                strokeWidth="1.33333"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="max-w-4xl">
            <h1 className="mb-2 text-2xl font-bold text-gray-800">
              SIA Agents Dashboard
            </h1>
            <p className="mb-8 text-gray-600">
              AI-powered agents for service blueprinting, process optimization,
              and more.
            </p>

            {/* Agents Section */}
            <div className="mb-6">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-gray-800">Agents</h2>
              </div>

              {/* Agent Cards */}
              <div className="flex gap-4">
                <AgentCard
                  title="Service Blueprinting Tool"
                  description="An assistant to optimise your service blueprint"
                  icon={<DocumentTextIcon className="h-6 w-6" />}
                  href="/blueprint"
                />

                <AgentCard
                  title="Process Optimizer"
                  description="Optimize business processes with AI-powered analysis"
                  icon={<CogIcon className="h-6 w-6" />}
                  href="/process-optimizer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
