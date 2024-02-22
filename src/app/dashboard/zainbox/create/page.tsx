import ZainboxCreateForm from "./zainbox-create-form";

export default function CreateZainboxPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">
          Create Zainbox
        </h1>
        <p className="text-muted-foreground">
          A Zainbox is a virtual bucket for creating and managing unlimited virtual accounts.
        </p>
      </div>
      <ZainboxCreateForm />
    </div>
  );
}
