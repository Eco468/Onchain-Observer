import { Router, type IRouter } from "express";
import healthRouter from "./health";
import walletsRouter from "./wallets";
import watchlistsRouter from "./watchlists";
import eventsRouter from "./events";
import alertsRouter from "./alerts";
import intelligenceRouter from "./intelligence";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(walletsRouter);
router.use(watchlistsRouter);
router.use(eventsRouter);
router.use(alertsRouter);
router.use(intelligenceRouter);
router.use(dashboardRouter);

export default router;
