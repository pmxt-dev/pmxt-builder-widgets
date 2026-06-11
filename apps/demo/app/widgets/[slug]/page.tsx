import { WidgetScreen } from '@/components/widget-screen';

export default async function WidgetPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    return <WidgetScreen slug={slug} />;
}
