This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Configuration

Custom Express + Socket.IO server (`server.js`), not `next start`. Required env vars:

| Variable | Purpose | Default |
|---|---|---|
| `CALENDAR_API_URL` | Base URL of the NestWorks calendar backend. Every `join-room` call forwards the caller's session token here (`GET /api/v1/academic/meets/authorize?roomId=`) to verify they're an actual participant before admitting them to the room. | `http://localhost:8080` |
| `ALLOWED_ORIGIN` | CORS origin allowed to connect to the Socket.IO server. Should be the NestWorks frontend's real domain in prod — `*` is a dev-only fallback. | `*` |
| `PORT` | HTTP port the server listens on. | `3000` |

There is no meets-specific secret or JWT signing key — the token forwarded to `CALENDAR_API_URL` is the caller's own NestWorks session JWT, verified by the calendar backend's normal auth (Spring Security), not by this service.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
