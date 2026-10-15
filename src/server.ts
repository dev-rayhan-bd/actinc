import { Server } from 'http';
import app from './app';
import mongoose from 'mongoose';
import config from './app/config';
import seedAdmin from './app/DB';
import 'dotenv/config';

// ── Register uncaughtException at the very top ──
process.on('uncaughtException', (err) => {
  console.error('😈 uncaughtException detected, shutting down...', err);
  process.exit(1);
});

let server: Server;

async function main() {
  try {
    await mongoose.connect(config.database_url as string);

    await seedAdmin();

    server = app.listen(config.port, () => {
      console.log(`app is listening on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to connect to database or start server:', err);
    process.exit(1);
  }
}

main();

// ── Handle unhandled promise rejections ──
process.on('unhandledRejection', (err) => {
  console.error('😈 unhandledRejection detected, shutting down...', err);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// ── Graceful Shutdown on termination signals ──
const gracefulShutdown = (signal: string) => {
  console.log(`Received ${signal}. Gracefully shutting down...`);
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        await mongoose.connection.close(false);
        console.log('MongoDB connection closed.');
        process.exit(0);
      } catch (err) {
        console.error('Error while closing MongoDB connection:', err);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));


