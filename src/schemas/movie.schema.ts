import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MovieDocument = HydratedDocument<Movie>;

@Schema()
export class Movie {
  @Prop()
  movie_id: string;

  @Prop()
  name: string;

  @Prop()
  variant: string;

  @Prop()
  category: string;

  @Prop()
  position: number;

  @Prop()
  dimension13: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const MovieSchema = SchemaFactory.createForClass(Movie);
