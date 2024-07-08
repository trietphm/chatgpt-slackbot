while true; do
  yarn start
  echo "Yarn start crashed with exit code $?. Restarting..." >&2
  sleep 1  # Optional: Add a small delay before restarting
done
