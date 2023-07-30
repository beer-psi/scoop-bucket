import handleEdge from "./endpoints/edge.ts";
import handleiTunes from "./endpoints/itunes.ts";
import { Application, Router } from "https://deno.land/x/oak@v12.6.0/mod.ts";

const router = new Router();
router.get("/itunes", handleiTunes);
router.get("/edge", handleEdge);


const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

app.listen({ port: 8000 });
