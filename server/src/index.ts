import dotenv from "dotenv";
import { createApp } from "./app";

dotenv.config();

const port = Number.parseInt(process.env.PORT || "3000", 10);
const app = createApp();

app.listen(port, () => {
  console.log(`crate listening on ${port}`);
});
