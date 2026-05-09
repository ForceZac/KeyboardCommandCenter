import { NextResponse } from 'next/server';
import { CategoryService } from '../../../services/CategoryService';

const service = new CategoryService();

export async function GET() {
  try {
    const categories = await service.listCategories();
    return NextResponse.json(categories);
  } catch (err) {
    console.error('[/api/categories] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
