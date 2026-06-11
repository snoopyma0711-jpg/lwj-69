import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import residentRouter from './routes/resident';
import frontdeskRouter from './routes/frontdesk';
import technicianRouter from './routes/technician';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: '物业报修调度系统服务正常运行' });
});

app.use('/api/auth', authRouter);
app.use('/api/resident', residentRouter);
app.use('/api/frontdesk', frontdeskRouter);
app.use('/api/technician', technicianRouter);

app.use((_req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`物业报修调度系统后端服务已启动: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`\n默认测试账号:`);
  console.log(`  物业前台: admin / 123456`);
  console.log(`  住户用户: resident1 / 123456 (1号楼101室)`);
  console.log(`  住户用户: resident2 / 123456 (2号楼302室)`);
  console.log(`  维修师傅: tech1 / 123456 (张师傅)`);
  console.log(`  维修师傅: tech2 / 123456 (李师傅)`);
  console.log(`\n请先运行 "npm run seed" 初始化测试数据`);
});
