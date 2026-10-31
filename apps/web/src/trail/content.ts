/**
 * TRACEN Vibe Coding Trail — content model.
 *
 * The "System Design Made Visual" handbook is the authoritative content
 * source. Topic numbering, terminology, analogies, and examples are
 * preserved. Production nuances that go beyond the handbook live in
 * docs/content-accuracy-review.md and are rendered as visually separate
 * "Production nuance" callouts on the topic pages.
 */

export type StageId = "entry" | "routing" | "execution" | "reliability" | "async";

export interface Stage {
  id: StageId;
  label: string;
  mission: string;
  topicIds: number[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface Topic {
  id: number;
  title: string;
  stage: StageId;
  problem: string;
  explanation: string;
  analogy: string;
  technical: string;
  walkthrough: string[];
  failureScenario: string;
  tradeoffs: string;
  takeaway: string;
  quiz: QuizQuestion;
}

export interface GlossaryEntry {
  term: string;
  definition: string;
  topicIds: number[];
  components: string[];
}

export const STAGES: Stage[] = [
  { id: "entry", label: "1. Entry", mission: "Protect the system", topicIds: [1] },
  { id: "routing", label: "2. Routing", mission: "Route requests correctly", topicIds: [2, 3, 4, 5] },
  { id: "execution", label: "3. Execution", mission: "Build and operate applications", topicIds: [6, 7, 8, 9] },
  { id: "reliability", label: "4. Reliability", mission: "Survive failures", topicIds: [10, 11, 12, 13, 14] },
  { id: "async", label: "5. Async Flow", mission: "Coordinate distributed work", topicIds: [15, 16, 17, 18, 19, 20] },
];

export const TOPICS: Topic[] = [
  {
    id: 1,
    title: "Rate Limiting",
    stage: "entry",
    problem:
      "A single aggressive user (or a malicious bot) sends 10,000 requests per second, exhausting your server's CPU and crashing the app for everyone else.",
    explanation:
      "Rate limiting acts as a bouncer at the door of your API. It tracks how many requests a specific IP address or User ID has made within a time window (e.g., 100 requests per minute). If they exceed the limit, the server rejects them.",
    analogy:
      "A fast-food drive-thru. You can order 5 burgers. If you try to order 5,000, they will tell you to pull over and stop blocking the line.",
    technical:
      "The most common algorithm is the Token Bucket. Imagine a bucket holding 100 tokens. Every request costs 1 token. Tokens refill at 10 per second. If the bucket is empty, requests get a 429 Too Many Requests HTTP response.",
    walkthrough: [
      "A client (IP 1.1) sends requests to the API gateway.",
      "The gateway counts the client's usage against its window.",
      "Each accepted request consumes one token from the bucket.",
      "Tokens refill continuously at the configured rate.",
      "When the bucket is empty, the client receives HTTP 429 with a retry-after hint.",
      "Other clients (IP 2.2, at 5/100) are unaffected.",
    ],
    failureScenario:
      "Without rate limiting, one bot starves every legitimate user of CPU, memory, and connections — a denial of service from a single actor.",
    tradeoffs:
      "Limits that are too strict block legitimate bursts (a user refreshing rapidly); limits that are too loose fail to protect the system. Distributed rate limiting needs a shared counter store (e.g., Redis), which itself must be highly available.",
    takeaway:
      "Rate limiting should happen at the Edge (API Gateway or CDN like Cloudflare), not in your application code. Your Node.js/Python app shouldn't waste CPU cycles checking if a user is allowed to make a request.",
    quiz: {
      question: "What HTTP status should a server return when a client exceeds its rate limit?",
      options: ["403 Forbidden", "429 Too Many Requests", "500 Internal Server Error", "408 Request Timeout"],
      answerIndex: 1,
      explanation:
        "429 Too Many Requests is the standard response. A good implementation also returns a retry-after hint so well-behaved clients can back off.",
    },
  },
  {
    id: 2,
    title: "Caching",
    stage: "routing",
    problem:
      "Database queries are slow and computationally expensive. If 100,000 users load the same homepage, forcing the database to calculate the top 10 articles 100,000 times will melt your database.",
    explanation:
      "A cache (like Redis or Memcached) is a lightning-fast, temporary storage layer that keeps data in RAM instead of on a hard drive. It remembers the answers to frequent questions.",
    analogy:
      "A cache is like a sticky note on your monitor: instead of walking to the filing cabinet (the database), the answer you use all day is already at your desk.",
    technical:
      "The dominant pattern is Cache-Aside: the app asks the cache first; on a miss it queries the database, writes the result into the cache, and returns it. The next request is a hit served in ~1ms.",
    walkthrough: [
      "App asks the cache: \"Do you have user 123's profile?\"",
      "Cache says \"No.\" (cache miss).",
      "App asks the database, gets the profile (e.g., 200ms).",
      "App saves the profile into the cache, then returns it to the user.",
      "The next request gets it from the cache in ~1ms.",
    ],
    failureScenario:
      "Stale data: the user updates their bio in the database, but the app forgets to delete the old bio from the cache. The user refreshes and still sees the old bio. Fix: always set a TTL (Time-To-Live) on cache keys.",
    tradeoffs:
      "Caches add a second source of truth. Stale reads, invalidation bugs, and cold-start misses are the price of speed. Cached data must also be treated as potentially exposed data — never cache sensitive user sessions on a public CDN.",
    takeaway:
      "Do not cache everything. Cache only data that is frequently read, infrequently updated, and expensive to compute.",
    quiz: {
      question: "In the cache-aside pattern, who is responsible for populating the cache?",
      options: [
        "The database writes to the cache automatically",
        "The application queries the cache, and on a miss queries the DB and writes the result to the cache",
        "The cache polls the database on a schedule",
        "The client sends the data to the cache directly",
      ],
      answerIndex: 1,
      explanation:
        "Cache-aside means the application code owns the read path: check cache, fall back to the database, and back-fill the cache. This keeps the cache logic explicit and the database unaware of the cache.",
    },
  },
  {
    id: 3,
    title: "Load Balancing",
    stage: "routing",
    problem:
      "One server can only handle so much traffic. If it crashes, your app dies. You need multiple servers, but users only know one URL (api.myapp.com).",
    explanation:
      "A Load Balancer acts as a traffic cop. It sits in front of your servers and distributes incoming requests evenly (e.g., Round Robin). It constantly health-checks servers; if Server B dies, the LB stops sending traffic to it.",
    analogy:
      "A host at a restaurant seating guests: instead of dumping everyone on one exhausted waiter, guests are spread across the staff — and a waiter who calls in sick gets no new tables.",
    technical:
      "Distribution strategies include Round Robin (rotate evenly), Least Connections (send to the busiest-free server), and IP Hash (sticky routing). Health checks probe each backend on an interval and eject unhealthy targets from the pool.",
    walkthrough: [
      "Clients send all requests to one address — the load balancer.",
      "The LB picks a healthy backend (Round Robin: Node 1, Node 2, Node 3, repeat).",
      "Backends respond; the LB forwards the response to the client.",
      "If a health check fails for Node 2, the LB removes it from rotation.",
      "Traffic continues on Node 1 and Node 3 with zero client changes.",
    ],
    failureScenario:
      "If the load balancer itself is a single instance, it is a single point of failure. Production LBs are deployed redundantly or managed by the cloud provider (AWS ALB, HAProxy pairs).",
    tradeoffs:
      "Sticky sessions (IP hash) help session-based apps but reduce even distribution. Health-check intervals trade detection speed against flapping sensitivity.",
    takeaway:
      "Load balancers give you horizontal scaling and high availability. Real-world tools: AWS ALB, HAProxy.",
    quiz: {
      question: "What happens to traffic when a backend server fails its health checks?",
      options: [
        "All requests fail until the server recovers",
        "The load balancer removes it from the pool and routes to healthy servers",
        "The load balancer retries the same server forever",
        "Clients must connect to a different URL",
      ],
      answerIndex: 1,
      explanation:
        "The core job of a load balancer is to route around failure: unhealthy backends are ejected from the pool, and traffic continues through healthy ones.",
    },
  },
  {
    id: 4,
    title: "Reverse Proxies",
    stage: "routing",
    problem:
      "You never want to expose your application servers directly to the internet: TLS certificates, compression, static files, and malicious clients are all concerns your app shouldn't handle per-request.",
    explanation:
      "A reverse proxy (Nginx, Caddy) sits in front of a server to shield it from the internet. While load balancers distribute traffic, reverse proxies modify it: terminating SSL/HTTPS, compressing responses, or serving static files directly without bothering the backend.",
    analogy:
      "A reverse proxy is like a hotel concierge: guests never knock on individual room doors — the concierge handles security, directions, and common requests before anyone reaches the room.",
    technical:
      "Client → Nginx → Backend. TLS is decrypted at the proxy (SSL termination), responses are gzipped, and static assets (JS/CSS/images) can be served from disk. In modern cloud environments, LB and reverse-proxy roles are often combined (an AWS ALB is both).",
    walkthrough: [
      "The client opens an HTTPS connection to the proxy.",
      "The proxy terminates TLS, inspects the path, and applies rules.",
      "Static file? Served directly from disk — the backend is never touched.",
      "Dynamic request? Forwarded (optionally compressed) to a backend.",
      "The backend response is returned through the proxy to the client.",
    ],
    failureScenario:
      "If the proxy goes down, no traffic reaches the backend at all — which is why proxies are deployed redundantly. Also: misconfigured headers (like forwarding the client's IP) break backend logging and rate limiting.",
    tradeoffs:
      "Extra network hop and configuration surface. But you gain centralized TLS, compression, security headers, and one place to shield the app from the internet.",
    takeaway:
      "Never expose app servers (Express, Django, uvicorn) directly to the internet on port 80/443 without a proxy.",
    quiz: {
      question: "What is the main difference between a load balancer and a reverse proxy?",
      options: [
        "A load balancer is faster than a reverse proxy",
        "A load balancer distributes traffic across servers; a reverse proxy terminates TLS, compresses, and modifies traffic",
        "Reverse proxies only work with HTTP/2",
        "They are exactly the same thing with different names",
      ],
      answerIndex: 1,
      explanation:
        "Distribution vs. modification. In practice the roles are often combined — an AWS ALB terminates TLS (proxy behavior) and spreads load (balancer behavior).",
    },
  },
  {
    id: 5,
    title: "API Gateways",
    stage: "routing",
    problem:
      "You have 10 different microservices (Auth, Billing, Users, Products). If the client app must talk to all 10 directly, it handles 10 URLs, authenticates 10 times, and pieces data together. It's a nightmare for the frontend.",
    explanation:
      "An API Gateway is a highly intelligent reverse proxy. It provides a single entry point for all clients and handles cross-cutting concerns: authentication validation (JWT checks), rate limiting, and routing requests to the correct internal microservice.",
    analogy:
      "The gateway is the building's front desk: one entrance, one ID check, and directions to the right office — visitors never wander the halls alone.",
    technical:
      "Mobile App → Gateway: verify JWT → rate limit → route /api/user to the User Service, /api/billing to the Billing Service, /api/search to the Search Service. Real tools: Kong, AWS API Gateway, Apollo Federation (GraphQL).",
    walkthrough: [
      "The client calls one URL: api.yourdomain.com.",
      "The gateway validates the JWT once.",
      "The gateway applies rate limits per client.",
      "It routes the request to the correct internal service.",
      "The service's response returns through the gateway to the client.",
    ],
    failureScenario:
      "The gateway adds a network hop to every request, and if not deployed redundantly it is a single point of failure (SPOF) that takes down every service at once.",
    tradeoffs:
      "Concentration of cross-cutting concerns vs. added latency and one more system to operate. Downstream services must not blindly trust arbitrary client-supplied identity headers — the trusted identity context must be established and protected by the gateway and internal communication controls.",
    takeaway:
      "Stop writing JWT validation code in every microservice. Validate the token once at the gateway, then pass a trusted User ID downstream.",
    quiz: {
      question: "If a script bypasses your browser entirely, does CORS still protect your API?",
      options: [
        "Yes — CORS blocks all non-browser requests",
        "No — CORS is a browser-enforced policy; use gateway auth, API keys, or other server-side controls",
        "Yes, as long as the API returns 403",
        "Only over HTTPS",
      ],
      answerIndex: 1,
      explanation:
        "CORS is enforced by browsers, not servers. Any non-browser client ignores it. Authentication and authorization must be enforced server-side (gateway, API keys, tokens).",
    },
  },
  {
    id: 6,
    title: "CI/CD (Continuous Integration / Delivery)",
    stage: "execution",
    problem:
      "\"It works on my machine!\" But when you drag-and-drop files to the server, things break. Dependencies are missing, tests were skipped, and the site goes down.",
    explanation:
      "CI/CD is an automated assembly line for your code. CI (Continuous Integration): every time you push code, a robot builds it and runs automated tests. CD (Continuous Delivery): if tests pass, the robot safely deploys the code to production.",
    analogy:
      "A car factory: no car leaves the plant without passing every inspection station. A failed brake test stops the line — the car never reaches the showroom.",
    technical:
      "Pipeline: Push Code → CI Server (Build → Run Tests) → Build Docker Image → Deploy to Production. A failing test marks the pipeline red, and the deploy stage is skipped — bad code cannot reach users.",
    walkthrough: [
      "A developer pushes code to the repository.",
      "The CI server builds the project.",
      "Automated tests run.",
      "If tests pass, a Docker image is built.",
      "If the build succeeds, the pipeline deploys the image to production.",
      "If any step fails, deployment is skipped and the team is notified.",
    ],
    failureScenario:
      "Deploying without CI: an AI-generated change with a broken import passes a manual glance, is copied to the server, and production 500s for every user. A CI gate would have caught it in seconds.",
    tradeoffs:
      "Pipeline maintenance, flaky tests that erode trust, and pipeline runtime (slow feedback). Skipping tests to get a green build defeats the entire purpose.",
    takeaway:
      "Never deploy AI-generated code directly to production without a CI pipeline that runs the test suite and the production build. If the pipeline fails, the bad code cannot reach users.",
    quiz: {
      question: "A pipeline runs: Push → Build → Test → Package → Deploy. The test stage fails. What happens?",
      options: [
        "Deployment proceeds with a warning",
        "The pipeline stops and deployment is skipped",
        "The tests are retried in production",
        "The build artifact replaces the test stage",
      ],
      answerIndex: 1,
      explanation:
        "Deployment gates exist to stop exactly this: a red test means the artifact never reaches users. 'Continue on error' turns your pipeline into decoration.",
    },
  },
  {
    id: 7,
    title: "Docker (Containerization)",
    stage: "execution",
    problem:
      "Code behaves differently on a Mac, a Windows machine, and a Linux server. Node version mismatches and missing environment variables cause deployment nightmares.",
    explanation:
      "Docker packs your code, the exact operating system it needs, and all its dependencies into a single, standardized box called a Container. If the container runs on your laptop, it will run the same way in the cloud.",
    analogy:
      "An Image is the recipe — a read-only snapshot. A Container is a running instance of that recipe. Like one recipe card baking 10 identical loaves.",
    technical:
      "A Dockerfile describes the image; multi-stage builds keep the final image small by compiling in one stage and shipping only the runtime in another. Virtual machines carry a full guest OS (GBs); containers share the host kernel and start in milliseconds. Production images should run as a non-root user.",
    walkthrough: [
      "Write a Dockerfile: base image, dependencies, app code, run command.",
      "Build an immutable image from it.",
      "Run a container — a live process from that image.",
      "Start more containers from the same image; each is isolated.",
      "Stop a container; the image remains, ready to run again.",
    ],
    failureScenario:
      "\"It runs on my machine\" becomes \"it runs in my container\" — but a container still shares the host kernel: huge version guarantees (\"mathematically guaranteed to run identically anywhere\") do not hold across every host environment. Consistency improves, not magic.",
    tradeoffs:
      "Image size, build time, and the discipline of writing Dockerfiles. Containers improve consistency but do not guarantee identical behavior across every host environment (kernel, architecture, and resource limits still matter).",
    takeaway:
      "Ask your AI to \"Write a production-ready Dockerfile for this app. Use a multi-stage build to keep the final image small, and run the app as a non-root user for security.\"",
    quiz: {
      question: "Which Docker concept represents a running instance: Image or Container?",
      options: ["Image", "Container"],
      answerIndex: 1,
      explanation:
        "The image is the frozen recipe; the container is the running process started from it. You can run 10 containers from 1 image.",
    },
  },
  {
    id: 8,
    title: "Kubernetes",
    stage: "execution",
    problem:
      "You have 50 Docker containers running across 10 different servers. If a server dies, who restarts the containers on a healthy server? How do containers find each other's IP addresses when they constantly change?",
    explanation:
      "Kubernetes is an orchestration system. You give it a YAML file stating: \"I want exactly 3 copies of the Auth Service running at all times.\" If a container crashes, K8s kills it and spins up a new one automatically to maintain the desired state.",
    analogy:
      "Kubernetes is a building manager with a checklist: \"3 guards on duty at all times.\" One calls in sick — the manager replaces them without being asked.",
    technical:
      "Pods are the smallest deployable units; ReplicaSets maintain the desired count; the Control Plane (managers) watches Worker Nodes and reconciles reality toward the declared state — self-healing.",
    walkthrough: [
      "Declare the desired state: 3 replicas of a service.",
      "The control plane schedules 3 pods on worker nodes.",
      "One pod crashes.",
      "Kubernetes detects reality (2 pods) vs. desired state (3).",
      "A replacement pod is started — desired state is restored.",
    ],
    failureScenario:
      "Kubernetes' healing only works within what it can observe: a crashed pod restarts, but a wedged process that never exits may look \"healthy\" forever without proper health probes. Misconfigured resource limits can also cause pods to be killed in loops.",
    tradeoffs:
      "A massive learning curve and operational overhead. Do not use Kubernetes for a simple MVP — stick to PaaS (Render, Heroku) or basic Docker instances until you have dozens of microservices and a dedicated DevOps engineer.",
    takeaway:
      "Kubernetes is not automatically necessary for a small MVP. It solves massive operational problems — by introducing massive operational overhead.",
    quiz: {
      question: "A Kubernetes cluster is running 3 replicas and one pod crashes. What happens?",
      options: [
        "Nothing, until an engineer restarts it",
        "Kubernetes notices the gap vs. desired state and starts a replacement pod",
        "The other pods stop too",
        "The YAML file must be re-applied manually",
      ],
      answerIndex: 1,
      explanation:
        "Reconciliation: the control plane continuously compares actual vs. desired state and acts to close the gap. That's the essence of orchestration.",
    },
  },
  {
    id: 9,
    title: "Service Discovery",
    stage: "execution",
    problem:
      "Because Kubernetes constantly destroys and creates containers, IP addresses change every minute. Service A cannot hardcode Service B's address.",
    explanation:
      "Service Discovery acts as an internal DNS. Service A asks for http://auth-service, and the discovery mechanism routes it to the current, correct IP.",
    analogy:
      "You never memorize your friend's hotel room number — you call the front desk and ask for them by name, even if they changed rooms.",
    technical:
      "A registry (etcd behind Kubernetes Services, Consul, DNS) maps stable service names to current healthy instances. Calls use logical names; the registry resolves and load-balances across live endpoints.",
    walkthrough: [
      "Service A needs the Auth Service.",
      "It calls http://auth-service — a name, not an IP.",
      "Discovery resolves the name to the current pod IP.",
      "The auth pod restarts and receives a new IP.",
      "Service A keeps calling the same name; traffic follows the new IP.",
    ],
    failureScenario:
      "Calling the pod IP directly: the moment the pod restarts, the hardcoded address goes stale and calls fail — the exact problem discovery exists to solve.",
    tradeoffs:
      "One more moving piece (the registry). Health information is only as fresh as the registry's last update; stale entries route traffic to dead instances.",
    takeaway:
      "Never hardcode instance IPs between services. Use service names and let discovery keep routing correct as instances come and go.",
    quiz: {
      question: "Why is calling a pod's IP directly unreliable in Kubernetes?",
      options: [
        "Pod IPs are encrypted",
        "Pods are created and destroyed constantly, so their IPs change",
        "Pod IPs only work from inside the same node",
        "IPs are shared between all pods",
      ],
      answerIndex: 1,
      explanation:
        "Pods are ephemeral by design. Service discovery provides a stable name that always resolves to the current healthy instance.",
    },
  },
  {
    id: 10,
    title: "Circuit Breakers",
    stage: "reliability",
    problem:
      "Service A calls Service B. Service B is overloaded and takes 30 seconds to respond. Service A waits, piling up pending connections until Service A runs out of memory and crashes too. This is a cascading failure.",
    explanation:
      "If Service B times out 5 times in a row, the Circuit Breaker \"opens\" (trips). For the next 30 seconds, Service A stops calling Service B entirely and instantly returns an error, giving Service B time to recover.",
    analogy:
      "An electrical circuit breaker: when a short circuit appears, the breaker trips instead of letting the wiring (your service) burn.",
    technical:
      "Three states: Closed (normal), Open (fast-fail, no calls forwarded), and a recovery window before probing again. Thresholds: N consecutive failures opens the circuit; after the cooldown the breaker half-opens and lets a trial call through.",
    walkthrough: [
      "Service A calls Service B through the breaker — normal (closed) operation.",
      "Service B slows down; calls start timing out.",
      "Failures reach the configured threshold.",
      "The circuit opens: further calls fail instantly — no waiting, no pile-up.",
      "After the recovery window, a trial call probes Service B.",
      "Success closes the circuit; normal traffic resumes.",
    ],
    failureScenario:
      "Graceful degradation in e-commerce: the recommendation engine is unavailable, the circuit breaker catches it, and the shopping cart continues to work perfectly — a degraded but functional experience.",
    tradeoffs:
      "Choosing thresholds: too sensitive trips on noise; too slow lets cascading failures spread. During the open window, users see fallback content, not real data.",
    takeaway:
      "Graceful degradation. If a non-critical microservice (like product reviews) goes down, wrap the call in a circuit breaker. Return an empty list instead of crashing the whole page.",
    quiz: {
      question: "What does a circuit breaker do while it is OPEN?",
      options: [
        "Sends every request to the failing service with a longer timeout",
        "Fails fast without calling the downstream service, then probes after a cooldown",
        "Restarts the downstream service",
        "Doubles the retry count",
      ],
      answerIndex: 1,
      explanation:
        "The whole point is protecting BOTH sides: the caller stops piling up connections, and the struggling downstream gets breathing room. After the cooldown, a probe decides whether to close the circuit.",
    },
  },
  {
    id: 11,
    title: "Timeouts",
    stage: "reliability",
    problem:
      "A downstream service is overloaded and takes 30 seconds to respond. Your server's threads or event-loop slots fill with waiting requests — resource exhaustion — and a slow dependency takes down your whole app.",
    explanation:
      "Never wait forever. Set a strict rule: \"If Service B doesn't answer in 2 seconds, drop the connection and return an error to the user.\" A timeout converts an unbounded wait into a bounded, fail-fast failure.",
    analogy:
      "Waiting for a friend who is late for a movie: after 5 minutes, you go in without them. Waiting all night ruins your evening AND the movie.",
    technical:
      "Every network call needs a deadline (connect timeout + read timeout). The timeout should be set to your SLO for the operation, not the worst case. Timeouts compose with retries and circuit breakers: a timeout defines what counts as a failure.",
    walkthrough: [
      "Service A calls Service B with a 2-second deadline.",
      "Service B responds in 200ms — success, user is happy.",
      "Service B gets slower: 1.5s — still inside the deadline.",
      "Service B now takes 4s — the deadline expires.",
      "Service A drops the call at 2s and fails fast.",
      "The user gets an immediate error instead of a hung page.",
    ],
    failureScenario:
      "No timeouts: one slow dependency holds every worker thread. Queue depths explode, memory climbs, health checks fail, and a single slow service cascades into a full outage.",
    tradeoffs:
      "Too aggressive: false failures on legitimately slow operations. Too lax: the failure cascade you were trying to prevent. Retry-on-timeout multiplies load on an already struggling service — combine with backoff and a breaker.",
    takeaway:
      "Every call to another system needs an explicit deadline. \"Default to infinite wait\" is how one slow service takes down an entire stack.",
    quiz: {
      question: "Using the handbook's example: what timeout should Service A use when calling Service B?",
      options: [
        "30 seconds, matching B's worst case",
        "No timeout at all",
        "2 seconds — a strict deadline, then drop the call",
        "Timeout equal to the client's timeout",
      ],
      answerIndex: 2,
      explanation:
        "The handbook's illustrative rule: \"If Service B doesn't answer in 2 seconds, drop the connection and return an error.\" The exact number depends on your SLO — the principle is that it must exist.",
    },
  },
  {
    id: 12,
    title: "Retries",
    stage: "reliability",
    problem:
      "Networks are flaky. Sometimes a request fails due to a 1-millisecond hiccup. If you give up immediately, the user gets an error. But retrying blindly can make things worse.",
    explanation:
      "If a request fails with a transient error (like HTTP 503 Service Unavailable or a timeout), automatically try again. Never retry client errors (like 400 Bad Request) — trying a bad password again won't fix it.",
    analogy:
      "Calling a friend and the line drops: you call back — the number was right, the connection was bad. But if you dialed a wrong number, redialing the same wrong number never helps.",
    technical:
      "Retry only idempotent operations and transient failures (5xx, timeouts, network errors). Cap attempts (e.g., max 3). Every retry costs downstream capacity — pair with exponential backoff and jitter (Topic 13) and prefer idempotency keys (Topic 14) for writes.",
    walkthrough: [
      "Service A calls an external API.",
      "The API returns 503 (temporarily unavailable) — retryable.",
      "The client waits and tries again.",
      "Attempt 2 succeeds — the user never saw an error.",
      "Alternative: the error is 400 (bad request) — not retryable, fail immediately.",
      "If attempts exhaust the maximum, surface a clear error.",
    ],
    failureScenario:
      "Retrying a payment POST without an idempotency key: the first request actually succeeded, its response was lost, and the retry charges the customer twice. Retries must be safe.",
    tradeoffs:
      "Retries multiply load: 3 retries = up to 4x traffic to a struggling service. Without backoff and jitter, a fleet of clients synchronizes its retries and accidentally DDoSes the recovering server.",
    takeaway:
      "When using an AI agent to write API integrations, explicitly prompt: \"Wrap this fetch call in a retry loop using exponential backoff and jitter, max 3 attempts, only on 5xx errors.\"",
    quiz: {
      question: "Which failure should you retry automatically?",
      options: ["400 Bad Request", "401 Unauthorized", "503 Service Unavailable", "422 Validation error"],
      answerIndex: 2,
      explanation:
        "5xx errors are usually transient. 4xx errors mean the REQUEST is wrong — resending an identical bad request can never succeed and only adds load.",
    },
  },
  {
    id: 13,
    title: "Exponential Backoff",
    stage: "reliability",
    problem:
      "If every client retries instantly and aggressively, 10,000 clients can all hit the struggling server at the same moment — you accidentally DDoS the very service you're waiting to recover.",
    explanation:
      "Don't retry instantly. Wait longer between each attempt: try 1, wait 1s; try 2, wait 2s; try 3, wait 4s. Add \"Jitter\" (randomness, e.g., 4.2s) so 10,000 clients don't all retry at the exact same millisecond.",
    analogy:
      "After knocking on a door with no answer, you don't knock again immediately — you wait a bit longer each time, and you don't knock in perfect sync with the neighbors.",
    technical:
      "Delay(n) = base × 2^(n-1) + jitter. Jitter decorrelates clients. Cap the maximum delay and the total deadline. Bounded exponential backoff with jitter is the default retry pacing for cloud SDKs.",
    walkthrough: [
      "Call fails (503).",
      "Wait 1s. Retry — fails again.",
      "Wait 2s + jitter (e.g., 2.4s). Retry — fails again.",
      "Wait 4s + jitter (e.g., 4.2s). Retry — success (200)!",
      "Without jitter, all clients would have retried at exactly 0s, 1s, 3s — synchronized waves of load.",
    ],
    failureScenario:
      "A retry storm: 10,000 clients fail at t=0. All retry at t=1s, t=3s, t=7s — each wave larger than the server's remaining capacity, so the service can never recover. Jitter spreads the waves into a smooth, survivable drizzle.",
    tradeoffs:
      "Longer backoff means slower user-facing recovery; shorter backoff risks retry storms. Jitter fixes synchronization but adds unpredictable latency.",
    takeaway:
      "Why is a retry loop dangerous without jitter? Because synchronized retries can accidentally DDoS the recovering server.",
    quiz: {
      question: "Why add jitter to retry delays?",
      options: [
        "To make retry timing unpredictable to attackers",
        "So thousands of clients don't retry at the exact same moment and overwhelm the recovering service",
        "Jitter makes retries faster",
        "It's required by HTTP",
      ],
      answerIndex: 1,
      explanation:
        "Jitter decorrelates clients. Without it, a fleet that failed together retries together in synchronized waves — each wave hammering the server as it tries to recover.",
    },
  },
  {
    id: 14,
    title: "Idempotency",
    stage: "reliability",
    problem:
      "You click \"Submit Payment.\" The app sends the request, the database deducts $50, but the network drops before the server can reply \"Success.\" The app thinks it failed and retries. The server receives the retry and deducts another $50. The customer is furious.",
    explanation:
      "An operation is idempotent if performing it multiple times has the exact same result as performing it once. Retrying an idempotent operation is safe; retrying a non-idempotent operation causes duplicate actions.",
    analogy:
      "An elevator call button: pressing it 10 times summons the same elevator once. Compare with a vending machine's coin slot — every push drops another snack.",
    technical:
      "The client generates a UUID for the transaction and sends it in the Idempotency-Key header. The backend checks its store: key seen before → return the recorded result immediately; key new → process, record, return. HTTP GET, PUT, DELETE are idempotent by definition; POST usually is not.",
    walkthrough: [
      "Client generates a unique key (b7f1...) for \"charge $50\".",
      "Request 1: server processes, deducts $50, stores key → result.",
      "The response is lost in the network.",
      "The client retries with the SAME key.",
      "Server recognizes the key, returns the recorded result — no second deduction.",
    ],
    failureScenario:
      "Bad (non-idempotent): POST /charge {amount: 50} twice → user charged twice. Good: with the Idempotency-Key header, the retry is recognized and ignored as a duplicate.",
    tradeoffs:
      "You must store keys and results (TTL-bounded). GET/PUT/DELETE being \"idempotent\" is an HTTP-method convention — application behavior still decides: a PUT that increments a counter is NOT idempotent in effect.",
    takeaway:
      "Always implement Idempotency Keys on endpoints that handle money, email sending, or data creation. Retries (Topic 12) are only safe when the retried operation is idempotent.",
    quiz: {
      question: "How do idempotency keys prevent duplicate charges?",
      options: [
        "They encrypt the payment",
        "The server records each processed key + result and returns the recorded result on retries instead of re-running the operation",
        "They make POST requests faster",
        "The client waits longer between retries",
      ],
      answerIndex: 1,
      explanation:
        "The key identifies an OPERATION, not a request. A retry with a known key is treated as \"already done\" — the stored result is replayed, never re-executed.",
    },
  },
  {
    id: 15,
    title: "Message Queues & Dead Letter Queues",
    stage: "async",
    problem:
      "When a user signs up, your app needs to save them to the DB, generate a PDF report, and send a welcome email. Doing this synchronously makes the user stare at a loading spinner for 10 seconds.",
    explanation:
      "A Message Queue (like RabbitMQ or AWS SQS) holds tasks in a line. The main web server drops the task in the queue and instantly responds to the user. A separate background \"Worker\" server pulls tasks from the queue and does the heavy lifting.",
    analogy:
      "A restaurant kitchen ticket rail: the waiter clips the order and returns to the floor immediately; chefs pull tickets in order. A ticket that keeps falling on the floor goes to the manager's desk (the DLQ).",
    technical:
      "Producers enqueue; consumers (workers) dequeue and process. If a worker crashes on a job, the job returns to the queue. After repeated failures (e.g., 3 retries), the job is permanently moved to the Dead Letter Queue — preventing poison messages from clogging the main queue forever. Engineers inspect the DLQ later to debug.",
    walkthrough: [
      "Web server validates the signup and saves the user to the DB.",
      "It enqueues {job: welcome_email, user_id} and returns in milliseconds.",
      "Worker A pulls the job and sends the email.",
      "The email API is down; the worker fails and the job returns to the queue.",
      "After 3 failed attempts the job is moved to the DLQ.",
      "An engineer inspects the DLQ, fixes the root cause, and replays the job.",
    ],
    failureScenario:
      "A poison message (malformed payload) crashes every worker that touches it. Without a DLQ it loops forever, blocking all jobs behind it.",
    tradeoffs:
      "Queues are for asynchronous, background tasks where the user doesn't need to wait. Never put a queue between your web server and database for standard reads/writes — it adds latency, ordering complexity, and another failure mode.",
    takeaway:
      "Move slow side effects (emails, PDFs, exports) behind a queue. Should a message queue sit in front of a real-time chat application? No — queues are for async work; use WebSockets for chat.",
    quiz: {
      question: "When is a job moved to a Dead Letter Queue?",
      options: [
        "Immediately on first failure",
        "After repeated processing failures (e.g., 3 retries), permanently",
        "When the queue is empty",
        "When the worker is busy",
      ],
      answerIndex: 1,
      explanation:
        "The DLQ is the graveyard for jobs that crashed too many times. This stops poison messages from clogging the main queue while preserving them for debugging.",
    },
  },
  {
    id: 16,
    title: "Pub/Sub (Publish/Subscribe)",
    stage: "async",
    problem:
      "In an e-commerce site, when an order is placed, 4 different systems need to know: Inventory, Shipping, Billing, and Analytics. If the Order Service calls all 4 directly, they are tightly coupled. If Billing is down, does the Order fail?",
    explanation:
      "Pub/Sub (like Kafka or Google Cloud Pub/Sub) is a broadcasting system. The Order Service (Publisher) shouts \"Order Placed!\" into a Topic. Any service that cares (Subscribers) listens to that Topic and acts independently.",
    analogy:
      "A radio tower: the station broadcasts once; every radio tuned to the channel hears it. The station neither knows nor cares who is listening.",
    technical:
      "Queue vs Pub/Sub: a Queue delivers 1 message to 1 worker (point-to-point, work distribution); Pub/Sub delivers 1 message to N subscribers (broadcast, event distribution). Failure isolation: if Analytics is down, the Order Service doesn't care — Pub/Sub holds the event, and Analytics processes the backlog after it boots back up.",
    walkthrough: [
      "Order Service publishes \"order_created\" to the topic.",
      "Inventory (subscriber) receives it and decrements stock.",
      "Billing (subscriber) receives it and charges the card.",
      "Analytics (subscriber) receives it and records metrics.",
      "Analytics is offline — the event waits; on recovery, it processes the backlog.",
    ],
    failureScenario:
      "Direct coupling without Pub/Sub: Billing is down, so Order Service calls fail, so checkout fails for everyone. One subscriber's outage must never break the publisher.",
    tradeoffs:
      "At-least-once delivery means subscribers must handle duplicates (idempotent consumers). Ordering guarantees vary by system. Debugging requires tracing (Topic 17).",
    takeaway:
      "Use Pub/Sub to decouple microservices. A new team can build a new feature (e.g., a \"Fraud Detection\" service) simply by subscribing to the existing \"order_created\" topic — without touching the Order Service code at all.",
    quiz: {
      question: "What is the core difference between a message queue and pub/sub?",
      options: [
        "Queues are faster than pub/sub",
        "A queue delivers each message to one consumer; pub/sub broadcasts to all subscribers",
        "Pub/sub requires a database",
        "They are identical",
      ],
      answerIndex: 1,
      explanation:
        "Point-to-point work distribution (queue) vs. broadcast event distribution (pub/sub). Use queues to share work; use pub/sub to notify many independent systems.",
    },
  },
  {
    id: 17,
    title: "Event-Driven Architecture (EDA)",
    stage: "async",
    problem:
      "Traditional architectures use \"Command\" patterns: Service A tells Service B \"Do this right now.\" As systems grow, this creates a tangled web of synchronous API calls that break easily.",
    explanation:
      "EDA is a paradigm shift. Services don't give commands; they broadcast Events (things that happened in the past). Other services listen and react. Pub/Sub and message queues become the central nervous system — the event bus.",
    analogy:
      "A town bulletin board: residents post what already happened (\"Lost cat found\"). Whoever cares reacts. Nobody commands strangers to act.",
    technical:
      "Central Event Bus (Kafka / EventBridge). Services publish events like UserCreated and ItemAdded; Email, Analytics, and the Data Lake consume independently. Because flows are asynchronous and decoupled, distributed tracing (a trace_id through every event) is mandatory — or you get debugging hell, jumping through logs across 5 services.",
    walkthrough: [
      "User Service broadcasts UserCreated {user_id, trace_id}.",
      "The event bus routes it to all subscribers of that event type.",
      "Email Service hears it → sends a welcome email.",
      "Analytics Data Lake hears it → records the signup.",
      "The same trace_id now appears in every service's logs.",
      "Cart Service later broadcasts ItemAdded with its own trace.",
    ],
    failureScenario:
      "Debugging hell: without a trace_id propagated through events, reconstructing one user action means grepping logs across 5 services with no shared identifier.",
    tradeoffs:
      "Loose coupling and independent evolution vs. eventual consistency and harder debugging. Event sourcing (advanced) makes it explicit: state is derived, not stored.",
    takeaway:
      "Name your events in the past tense (InvoicePaid, AccountDeleted). They represent immutable facts that already occurred, not commands of what should happen next. Event sourcing example: a bank balance isn't a \"$100\" row — it's the calculated sum of Deposit($50), Withdraw($10), Deposit($60).",
    quiz: {
      question: "Why should events be named in the past tense (e.g., InvoicePaid)?",
      options: [
        "It looks cleaner in logs",
        "Events are immutable facts that already happened — not commands telling another service what to do",
        "Past-tense names are faster to serialize",
        "Only because Kafka requires it",
      ],
      answerIndex: 1,
      explanation:
        "An event describes a fact. What subscribers do about it is their decision — that distinction is the heart of event-driven design.",
    },
  },
  {
    id: 18,
    title: "Distributed Transactions",
    stage: "async",
    problem:
      "In a single database, a SQL transaction ensures deducting $50 and adding $50 happens at all once (ACID). But what if the deduction happens in the Billing Microservice DB and the addition in the Rewards Microservice DB?",
    explanation:
      "You cannot use a standard SQL BEGIN...COMMIT across two separate databases over a network. A Distributed Transaction is the complex protocol used to ensure data consistency across multiple independent services.",
    analogy:
      "Two banks must both agree on a wire transfer, by phone, with a dropped call possible at any moment — there is no shared ledger they can both write to atomically.",
    technical:
      "Two-Phase Commit (2PC) — the old way: a Coordinator asks all databases \"Are you ready to commit?\" (Phase 1). If all say YES, it says \"Commit now!\" (Phase 2). If one says NO, it aborts. Trade-off: extremely slow, and it locks rows in all databases until the network resolves. Rarely used in modern microservices.",
    walkthrough: [
      "The coordinator broadcasts PREPARE to Billing DB and Rewards DB.",
      "Both vote YES: they have locked their rows and can commit.",
      "The coordinator broadcasts COMMIT.",
      "Both commit — the transfer is consistent.",
    ],
    failureScenario:
      "The two-database problem: Billing DB deducts $50 (success) — then Rewards DB CRASHES. Result: money deducted, but the reward is never credited. Data is corrupted. Partial failure is the defining risk of cross-database writes.",
    tradeoffs:
      "2PC gives coordination safety at the cost of latency, locks, and a coordinator that itself can fail. Reducing cross-database writes in the first place is usually the better engineering answer.",
    takeaway:
      "The best way to handle distributed transactions is to avoid them entirely. Design bounded contexts so a single transaction only ever needs to mutate a single database. If you must span databases, use the Saga Pattern (Topic 19).",
    quiz: {
      question: "What is the main trade-off of Two-Phase Commit (2PC)?",
      options: [
        "It cannot guarantee consistency",
        "It is slow and holds locks across databases until the network round-trips resolve",
        "It only works with NoSQL",
        "It cannot handle a NO vote",
      ],
      answerIndex: 1,
      explanation:
        "Prepare/Commit round-trips hold row locks in every participant while the coordinator waits. Under network trouble those locks stretch out — which is why modern microservices rarely use 2PC.",
    },
  },
  {
    id: 19,
    title: "Saga Pattern",
    stage: "async",
    problem:
      "We need distributed transactions (Topic 18) but Two-Phase Commit is too slow and locks the database.",
    explanation:
      "A Saga breaks a distributed transaction into a sequence of local transactions. Each step updates a local database and publishes an event to trigger the next step. If a step fails, the Saga executes Compensating Transactions (undo steps) backward to restore the original state.",
    analogy:
      "A wedding planner with a cancellation clause for every vendor: if the venue falls through at the last step, the planner unwinds each earlier booking in reverse — florist refunded, band cancelled, deposit returned.",
    technical:
      "Choreography: services react to events automatically (like dancers reacting to music) — good for simple flows, hard to track. Orchestration: a central \"Saga Manager\" script tells every service exactly what to do (like a conductor) — better for complex flows (e.g., AWS Step Functions).",
    walkthrough: [
      "Step 1: Create Order — local transaction commits, publishes event.",
      "Step 2: Charge Card — local transaction commits, publishes event.",
      "Step 3: Ship Product — FAILS.",
      "Compensation: publish ShippingFailed.",
      "Billing hears it and refunds the card (undo of step 2).",
      "Orders hears it and cancels the order (undo of step 1).",
    ],
    failureScenario:
      "Compensations are business-level corrective actions, not guaranteed restoration of the exact original database state. For a few seconds the order exists and the card is charged while shipping fails — eventual consistency, which your UI must reflect with states like \"Processing\" rather than just \"Done\".",
    tradeoffs:
      "Sagas give up ACID isolation for availability and no cross-database locks. The cost: intermediate states are visible, compensation logic must be designed for every step, and debugging flows requires tracing.",
    takeaway:
      "Your app deducts inventory but fails to charge the card. How do you fix the database? A compensating transaction in a Saga — undo the earlier steps backward.",
    quiz: {
      question: "In a saga, what happens when the Shipping step fails after Order creation and card charge?",
      options: [
        "The databases remain corrupted until a manual fix",
        "Compensating transactions run backward: refund the card, cancel the order",
        "2PC rolls back all databases atomically",
        "The order stays in \"Processing\" forever",
      ],
      answerIndex: 1,
      explanation:
        "Sagas undo forward progress with compensation events. Note the nuance: compensation is a business-level correction (a refund), not a byte-identical database rollback.",
    },
  },
  {
    id: 20,
    title: "Cron Jobs (Scheduled Tasks)",
    stage: "async",
    problem:
      "Some tasks shouldn't be triggered by a user click. You need to send a \"Weekly Digest\" email every Sunday at midnight, or purge deleted files from the database every 24 hours.",
    explanation:
      "A Cron Job is a time-based job scheduler. You define a schedule with a specific syntax (e.g., 0 0 * * 0) and the system executes a script exactly at that time.",
    analogy:
      "A school bell: it rings at fixed times regardless of whether anyone asks. But if three schools run the same bell on the same clock, everyone gets the announcement three times.",
    technical:
      "Cron syntax: minute(0) hour(0) day(any) month(any) weekday(Sun=0) — 0 0 * * 0 = every Sunday at midnight. Best practice: cron doesn't do heavy work — it just adds jobs to a queue; workers do the work.",
    walkthrough: [
      "Define the schedule: 0 0 * * 0 (Sunday 00:00).",
      "The scheduler fires and enqueues a job (not doing the work itself).",
      "A worker pulls the job from the queue and runs it.",
      "Duplicates: 3 API servers each running the same in-app cron send 3 emails.",
      "Fix: a distributed lock (Redis) so only one server claims the job.",
    ],
    failureScenario:
      "Duplicate execution: with 3 app servers and the cron coded inside the app, all 3 run at midnight — users get 3 emails. Timezones: 0 0 * * * runs at server time (usually UTC) — New York users get their \"Morning Report\" at 7–8 PM the night before, shifting with Daylight Saving Time.",
    tradeoffs:
      "Timezones and missed executions: production schedulers need explicit timezone configuration and a policy for missed runs (catch-up vs. skip). Distributed locks add a dependency; external orchestrators (AWS EventBridge, Inngest) solve both at the cost of a service.",
    takeaway:
      "Beware timezones. Always store and process dates in UTC. Use a distributed lock or an external orchestrator so exactly one scheduler claims the job.",
    quiz: {
      question: "Why can an in-app cron job send users duplicate emails?",
      options: [
        "Cron syntax is ambiguous",
        "With multiple app servers, each instance independently runs the same schedule",
        "Email providers retry automatically",
        "Cron always runs twice for reliability",
      ],
      answerIndex: 1,
      explanation:
        "Every replica owns the same schedule. A distributed lock (so only one claims the job) or an external orchestrator makes execution singular.",
    },
  },
];

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "API Gateway",
    definition:
      "A single, intelligent entry point for all clients that validates auth, applies rate limits, and routes requests to internal services.",
    topicIds: [5],
    components: ["JWT validation", "Rate limiting", "Routing"],
  },
  {
    term: "Cache",
    definition: "A fast, temporary storage layer (e.g., Redis) that keeps frequently read answers in RAM instead of hitting the database.",
    topicIds: [2],
    components: ["Redis", "Memcached", "TTL"],
  },
  {
    term: "Cache Hit",
    definition: "A request served directly from the cache (~1ms) because the answer was already stored.",
    topicIds: [2],
    components: ["Cache-aside", "Redis"],
  },
  {
    term: "Cache Miss",
    definition: "A request the cache cannot answer; the app must query the database and back-fill the cache.",
    topicIds: [2],
    components: ["Cache-aside", "Database"],
  },
  {
    term: "Circuit Breaker",
    definition:
      "A reliability switch that stops calling a failing downstream service after a failure threshold, failing fast until a recovery window passes.",
    topicIds: [10],
    components: ["Closed", "Open", "Half-open", "Fallback"],
  },
  {
    term: "CI/CD",
    definition: "Robots that build, test, and deploy your code. CI integrates on every push; CD delivers tested artifacts safely to production.",
    topicIds: [6],
    components: ["Pipeline", "Gates", "Docker image"],
  },
  {
    term: "Container",
    definition: "A running instance of an image — a lightweight process that shares the host kernel instead of carrying a guest OS.",
    topicIds: [7],
    components: ["Docker engine", "Host kernel"],
  },
  {
    term: "Docker Image",
    definition: "A read-only snapshot built from a Dockerfile — the recipe from which containers run.",
    topicIds: [7],
    components: ["Dockerfile", "Multi-stage build"],
  },
  {
    term: "Dead Letter Queue (DLQ)",
    definition: "A graveyard for background jobs that crashed too many times, keeping poison messages out of the main queue for later debugging.",
    topicIds: [15],
    components: ["Main queue", "Retries", "Workers"],
  },
  {
    term: "Distributed Transaction",
    definition: "A protocol attempting ACID-like consistency across multiple independent databases, e.g., Two-Phase Commit.",
    topicIds: [18],
    components: ["Coordinator", "Prepare", "Commit", "2PC"],
  },
  {
    term: "Event Bus",
    definition: "The central nervous system of event-driven architecture (Kafka, EventBridge) through which services broadcast and consume events.",
    topicIds: [17],
    components: ["Kafka", "EventBridge", "Trace ID"],
  },
  {
    term: "Eventual Consistency",
    definition:
      "The acceptance that data converges to a consistent state after a delay, rather than instantly across all services (e.g., during a saga).",
    topicIds: [19, 17],
    components: ["Saga", "Processing state", "UI states"],
  },
  {
    term: "Idempotency",
    definition:
      "An operation that produces the same result whether performed once or many times, making retries safe (e.g., via Idempotency-Key headers).",
    topicIds: [14, 12],
    components: ["Idempotency-Key", "Retry", "Recorded result"],
  },
  {
    term: "Jitter",
    definition: "Randomness added to retry delays so thousands of clients don't retry at the exact same millisecond.",
    topicIds: [13],
    components: ["Exponential backoff", "Retry storm"],
  },
  {
    term: "Load Balancer",
    definition: "A traffic cop that distributes requests across healthy servers and stops routing to ones that fail health checks.",
    topicIds: [3],
    components: ["Round Robin", "Health checks", "AWS ALB", "HAProxy"],
  },
  {
    term: "Pub/Sub",
    definition: "A radio tower: one service broadcasts an event to a topic and any number of subscribers hear it independently.",
    topicIds: [16],
    components: ["Topic", "Publisher", "Subscriber", "Kafka"],
  },
  {
    term: "Reverse Proxy",
    definition: "A shield in front of your servers that terminates TLS, compresses responses, and serves static files (Nginx, Caddy).",
    topicIds: [4],
    components: ["SSL termination", "Compression", "Nginx"],
  },
  {
    term: "Saga",
    definition:
      "A chain of local transactions with compensating undo steps that manages distributed workflows without locking databases.",
    topicIds: [19, 18],
    components: ["Choreography", "Orchestration", "Compensating transaction"],
  },
  {
    term: "Service Discovery",
    definition: "An internal DNS that resolves stable service names to the current IPs of healthy instances.",
    topicIds: [9, 8],
    components: ["Service name", "Registry", "DNS"],
  },
  {
    term: "Token Bucket",
    definition: "A rate-limiting algorithm: a bucket of tokens refilled at a fixed rate where each request costs one token; an empty bucket rejects with 429.",
    topicIds: [1],
    components: ["Capacity", "Refill rate", "HTTP 429"],
  },
  {
    term: "TTL (Time-To-Live)",
    definition: "The expiry time set on cache keys so stale data ages out automatically even if invalidation is missed.",
    topicIds: [2],
    components: ["Stale data", "Cache invalidation"],
  },
  {
    term: "Worker",
    definition: "A background consumer that pulls jobs from a queue and does the heavy lifting away from the request path.",
    topicIds: [15, 20],
    components: ["Queue", "DLQ", "Retries"],
  },
];

export const FINAL_QUIZ: QuizQuestion[] = [
  {
    question: "If a script bypasses a browser, does CORS protect the API?",
    options: ["Yes", "No — use an API Gateway / Auth"],
    answerIndex: 1,
    explanation:
      "CORS is a browser-enforced policy. Non-browser clients ignore it entirely — enforcement must be server-side (gateway auth, API keys).",
  },
  {
    question: "Why is a Retry loop dangerous without Jitter?",
    options: [
      "It can accidentally DDoS the recovering server",
      "It uses more battery",
      "It breaks HTTPS",
      "It isn't dangerous at all",
    ],
    answerIndex: 0,
    explanation:
      "Clients that failed together retry together in synchronized waves. Jitter spreads those waves out so the recovering server can catch up.",
  },
  {
    question: "Should you put a Message Queue in front of a real-time Chat application?",
    options: ["Yes, always", "No — queues are for async work. Use WebSockets"],
    answerIndex: 1,
    explanation:
      "Queues trade latency for durability and decoupling — the opposite of what real-time chat needs. Use WebSockets for live delivery.",
  },
  {
    question: "Your app deducts inventory but fails to charge the card. How do you fix the database?",
    options: [
      "A Compensating Transaction in a Saga",
      "A manual SQL UPDATE in production",
      "2PC on the next request",
      "Restart the database",
    ],
    answerIndex: 0,
    explanation:
      "Sagas undo earlier steps with compensation events (restore inventory). Compensation is a business-level correction, not a byte-identical rollback.",
  },
  {
    question: "Which Docker concept represents a running instance: Image or Container?",
    options: ["Image", "Container"],
    answerIndex: 1,
    explanation: "The image is the frozen recipe; the container is the live process started from it.",
  },
];

export const getTopic = (id: number): Topic | undefined => TOPICS.find((t) => t.id === id);

export const stageOf = (id: number): Stage | undefined => STAGES.find((s) => s.topicIds.includes(id));
