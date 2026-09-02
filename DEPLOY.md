# Deploying

Contract ids are committed in `vercel.json` under `build.env` — they are public
addresses, not secrets, so baking them in removes seven fields from the setup.

The **one** value you must set yourself is `NEXT_PUBLIC_API_URL`, because it
depends on where the backend landed.

## Vercel

1. **Add New → Project**, import `otobongdev/sci-healthcare-frontend`.
2. Framework preset is detected as Next.js from `vercel.json`.
3. Under **Environment Variables**, add one:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_URL` | your Render URL, e.g. `https://sci-healthcare-api.onrender.com` |

4. Deploy.

> `NEXT_PUBLIC_*` is inlined into the client bundle at **build** time. Adding or
> changing it later does nothing until you redeploy. If the live site is calling
> `localhost`, this variable was missing when the build ran — set it and
> **Redeploy**, do not just restart.

## After both are up

Set `CORS_ORIGIN` on the Render service to the Vercel URL, then redeploy the
backend. Until you do, the browser blocks every API call and the app renders
empty with CORS errors in the console.

## Checking it worked

```bash
curl -s https://<your-render-url>/ready | jq        # 200, low lagLedgers
curl -s https://<your-render-url>/stats | jq        # non-zero providers
```

Then open the Vercel URL. The clinic directory should list **Ikeja General
Clinic** with three services. If the page loads but the directory is empty, the
backend is up but CORS or `NEXT_PUBLIC_API_URL` is wrong — check the browser
console, not the server logs.
