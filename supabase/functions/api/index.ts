// Supabase Edge Function entry for the game API.
//
// The routes, ladder and chain code live in server/ and are shared with the
// Node entry (server/index.js); this file only hosts them. Requests arrive as
// /api/<route>, which is already where every route is mounted.
import './node-globals.ts'
import { createApp } from '../../../server/app.js'

const { app } = createApp()

app.listen(Number(Deno.env.get('PORT') ?? 8000))
