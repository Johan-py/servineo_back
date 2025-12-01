import { Router, RequestHandler } from 'express';
import { CitaController } from '../controllers/cita.controller';
import { extractGoogleToken } from '../middlewares/googleAuth.middleware';
import { provisionalAuthMiddleware } from '../middlewares/validate.middleware';

const router = Router();

// Aplicar middleware de extracción de token de Google a todas las rutas
router.use(extractGoogleToken);

router.post('/', CitaController.crear);
router.get('/proveedor/:proveedorId', CitaController.listarPorProveedor);
router.get('/cliente/:clienteId', CitaController.listarPorCliente);
router.put('/:id', CitaController.actualizar);

router.put('/:citaId/cancelar', provisionalAuthMiddleware as unknown as RequestHandler, 
  CitaController.cancelarCita as unknown as RequestHandler 
);

// ✅ Ruta para eliminar una cita por proveedor
router.delete('/:id/proveedor', CitaController.eliminarPorProveedor);

export default router;
