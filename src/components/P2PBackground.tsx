export const P2PBackground = () => {
  return (
    <div class="fixed inset-0 overflow-hidden z-0 bg-base-100">
      <div class="absolute inset-0 opacity-5">
        <div class="grid grid-cols-20 grid-rows-20 w-full h-full">
          {Array.from({ length: 400 }).map((_, i) => (
            <div class="border border-base-300" />
          ))}
        </div>
      </div>
    </div>
  );
};
