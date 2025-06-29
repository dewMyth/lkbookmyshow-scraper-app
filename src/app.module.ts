import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { Movie, MovieSchema } from './schemas/movie.schema';
import { ScheduleModule } from '@nestjs/schedule';
import { Email, EmailSchema } from './schemas/email.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // makes ConfigService available app-wide
      envFilePath: '.env', // optional if using default `.env`
    }),
    MongooseModule.forRoot(process.env.MONGO_CONNECTION_URI as string),
    // MongooseModule.forRoot(
    //   'mongodb+srv://dewmyth:Lso4hb6eYDc1APjB@cluster0.nvij6jq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
    // ),
    MongooseModule.forFeature([{ name: Movie.name, schema: MovieSchema }]),
    MongooseModule.forFeature([{ name: Email.name, schema: EmailSchema }]),
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
