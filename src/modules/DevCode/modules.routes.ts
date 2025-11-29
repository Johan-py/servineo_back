import { Router } from "express";

import proveedorRoutes from "./routes/proveedor.routes";
import citaRoutes from "./routes/cita.routes";
import servicioRoutes from "./routes/servicio.routes";
import clienteRoutes from "./routes/cliente.routes";

const router = Router();

const log = (path: string) => console.log(`  - /api/devcode${path}`);

router.use("/proveedores", proveedorRoutes);  log("/proveedores");
router.use("/citas", citaRoutes);             log("/citas");
router.use("/servicios", servicioRoutes);     log("/servicios");
router.use("/clientes", clienteRoutes);       log("/clientes");

export default router;